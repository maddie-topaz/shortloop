import * as aws from '@pulumi/aws';
import { PolicyPack, validateResourceOfType } from '@pulumi/policy';

const PUBLIC_CIDRS = ['0.0.0.0/0', '::/0'];
const PUBLIC_WEB_PORTS = [80, 443];
const SECRET_NAME_PATTERN = /password|secret|token|credential|private_key|apikey|api_key/i;

const isPublic = (cidrBlocks: string[] | undefined): boolean =>
  (cidrBlocks ?? []).some((cidr) => PUBLIC_CIDRS.includes(cidr));

new PolicyPack('shortloop-policies', {
  policies: [
    {
      name: 'no-public-ingress-except-web',
      description:
        'Security groups may only accept traffic from the internet on HTTP/HTTPS. The database and the service must sit behind the load balancer.',
      enforcementLevel: 'mandatory',
      validateResource: validateResourceOfType(aws.ec2.SecurityGroup, (sg, args, reportViolation) => {
        for (const rule of sg.ingress ?? []) {
          if (!isPublic(rule.cidrBlocks) && !isPublic(rule.ipv6CidrBlocks)) {
            continue;
          }
          const from = rule.fromPort;
          const to = rule.toPort;
          const isWebOnly = PUBLIC_WEB_PORTS.includes(from) && PUBLIC_WEB_PORTS.includes(to);
          if (!isWebOnly) {
            reportViolation(
              `${args.name} allows the internet to reach ports ${from}-${to}. Only ${PUBLIC_WEB_PORTS.join('/')} may be publicly exposed; everything else must be restricted to a source security group.`,
            );
          }
        }
      }),
    },
    {
      name: 'rds-not-publicly-accessible',
      description: 'The database must not be reachable from the internet.',
      enforcementLevel: 'mandatory',
      validateResource: validateResourceOfType(aws.rds.Instance, (db, args, reportViolation) => {
        if (db.publiclyAccessible) {
          reportViolation(
            `${args.name} sets publiclyAccessible. The database must only be reachable from inside the VPC.`,
          );
        }
      }),
    },
    {
      name: 'no-plaintext-secrets-in-task-definition',
      description:
        'Secrets belong in the task definition "secrets" block (backed by Secrets Manager), never in plaintext "environment" variables.',
      enforcementLevel: 'mandatory',
      validateResource: validateResourceOfType(aws.ecs.TaskDefinition, (task, args, reportViolation) => {
        let containers: { environment?: { name?: string }[] }[];
        try {
          containers = JSON.parse(task.containerDefinitions);
        } catch {
          reportViolation(`${args.name} has containerDefinitions that could not be parsed as JSON.`);
          return;
        }
        for (const container of containers) {
          for (const env of container.environment ?? []) {
            if (env.name && SECRET_NAME_PATTERN.test(env.name)) {
              reportViolation(
                `${args.name} passes "${env.name}" as a plaintext environment variable. Use the "secrets" block with a Secrets Manager ARN instead.`,
              );
            }
          }
        }
      }),
    },
    {
      name: 'log-groups-must-expire',
      description: 'Log groups without a retention period keep logs forever and bill forever.',
      enforcementLevel: 'mandatory',
      validateResource: validateResourceOfType(aws.cloudwatch.LogGroup, (group, args, reportViolation) => {
        if (!group.retentionInDays) {
          reportViolation(`${args.name} has no retentionInDays, so its logs are kept indefinitely.`);
        }
      }),
    },
    {
      name: 'rds-storage-should-be-encrypted',
      description:
        'RDS storage should be encrypted at rest. Advisory because enabling it on an existing instance forces a replacement, which destroys the data.',
      enforcementLevel: 'advisory',
      validateResource: validateResourceOfType(aws.rds.Instance, (db, args, reportViolation) => {
        if (!db.storageEncrypted) {
          reportViolation(`${args.name} does not set storageEncrypted.`);
        }
      }),
    },
    {
      name: 'rds-should-take-a-final-snapshot',
      description:
        'Skipping the final snapshot means a destroy is unrecoverable. Advisory: deliberate for a throwaway testbed, wrong for anything holding real data.',
      enforcementLevel: 'advisory',
      validateResource: validateResourceOfType(aws.rds.Instance, (db, args, reportViolation) => {
        if (db.skipFinalSnapshot) {
          reportViolation(`${args.name} sets skipFinalSnapshot, so destroying it leaves no recovery point.`);
        }
      }),
    },
  ],
});
