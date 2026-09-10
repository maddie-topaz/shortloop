import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as random from '@pulumi/random';

const config = new pulumi.Config();
const imageTag = config.get('imageTag') ?? 'bootstrap';
const containerPort = 4000;

const vpc = aws.ec2.getVpcOutput({ default: true });
const subnets = vpc.id.apply((vpcId) =>
  aws.ec2.getSubnetsOutput({ filters: [{ name: 'vpc-id', values: [vpcId] }] }),
);
const subnetIds = subnets.ids;

const repo = new aws.ecr.Repository('shortloop', {
  forceDelete: true,
});

const albSg = new aws.ec2.SecurityGroup('shortloop-alb', {
  vpcId: vpc.id,
  ingress: [{ protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const serviceSg = new aws.ec2.SecurityGroup('shortloop-service', {
  vpcId: vpc.id,
  ingress: [{ protocol: 'tcp', fromPort: containerPort, toPort: containerPort, securityGroups: [albSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const dbSg = new aws.ec2.SecurityGroup('shortloop-db', {
  vpcId: vpc.id,
  ingress: [{ protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [serviceSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const dbPassword = new random.RandomPassword('shortloop-db-password', {
  length: 24,
  special: false,
});

const dbSubnetGroup = new aws.rds.SubnetGroup('shortloop', { subnetIds });

const db = new aws.rds.Instance('shortloop', {
  engine: 'postgres',
  instanceClass: 'db.t4g.micro',
  allocatedStorage: 20,
  dbName: 'shortloop',
  username: 'shortloop',
  password: dbPassword.result,
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [dbSg.id],
  publiclyAccessible: false,
  skipFinalSnapshot: true,
});

const databaseUrl = pulumi.interpolate`postgres://shortloop:${dbPassword.result}@${db.address}:5432/shortloop`;

const databaseUrlSecret = new aws.secretsmanager.Secret('shortloop-database-url', {});
new aws.secretsmanager.SecretVersion('shortloop-database-url', {
  secretId: databaseUrlSecret.id,
  secretString: databaseUrl,
});

const logGroup = new aws.cloudwatch.LogGroup('shortloop', { retentionInDays: 14 });

const executionRole = new aws.iam.Role('shortloop-execution', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' },
    ],
  }),
});
new aws.iam.RolePolicyAttachment('shortloop-execution-managed', {
  role: executionRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
});
new aws.iam.RolePolicy('shortloop-execution-secrets', {
  role: executionRole.id,
  policy: databaseUrlSecret.arn.apply((arn) =>
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Action: 'secretsmanager:GetSecretValue', Resource: arn }],
    }),
  ),
});

const taskRole = new aws.iam.Role('shortloop-task', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      { Effect: 'Allow', Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' },
    ],
  }),
});

const cluster = new aws.ecs.Cluster('shortloop');

const taskDefinition = new aws.ecs.TaskDefinition('shortloop', {
  family: 'shortloop',
  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',
  cpu: '256',
  memory: '512',
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'shortloop',
      image: pulumi.interpolate`${repo.repositoryUrl}:${imageTag}`,
      portMappings: [{ containerPort, protocol: 'tcp' }],
      environment: [{ name: 'PORT', value: String(containerPort) }],
      secrets: [{ name: 'DATABASE_URL', valueFrom: databaseUrlSecret.arn }],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': logGroup.name,
          'awslogs-region': aws.getRegionOutput().name,
          'awslogs-stream-prefix': 'shortloop',
        },
      },
    },
  ]),
});

const alb = new aws.lb.LoadBalancer('shortloop', {
  loadBalancerType: 'application',
  subnets: subnetIds,
  securityGroups: [albSg.id],
});

const targetGroup = new aws.lb.TargetGroup('shortloop', {
  port: containerPort,
  protocol: 'HTTP',
  targetType: 'ip',
  vpcId: vpc.id,
  healthCheck: { path: '/api/links', matcher: '200' },
});

const listener = new aws.lb.Listener('shortloop', {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: 'HTTP',
  defaultActions: [{ type: 'forward', targetGroupArn: targetGroup.arn }],
});

const service = new aws.ecs.Service(
  'shortloop',
  {
    cluster: cluster.arn,
    taskDefinition: taskDefinition.arn,
    desiredCount: 1,
    launchType: 'FARGATE',
    networkConfiguration: {
      subnets: subnetIds,
      securityGroups: [serviceSg.id],
      assignPublicIp: true,
    },
    loadBalancers: [{ targetGroupArn: targetGroup.arn, containerName: 'shortloop', containerPort }],
  },
  { dependsOn: [listener] },
);

const scalableTarget = new aws.appautoscaling.Target('shortloop', {
  serviceNamespace: 'ecs',
  scalableDimension: 'ecs:service:DesiredCount',
  resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
  minCapacity: 1,
  maxCapacity: 3,
});

new aws.appautoscaling.Policy('shortloop-cpu', {
  serviceNamespace: scalableTarget.serviceNamespace,
  scalableDimension: scalableTarget.scalableDimension,
  resourceId: scalableTarget.resourceId,
  policyType: 'TargetTrackingScaling',
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: { predefinedMetricType: 'ECSServiceAverageCPUUtilization' },
    targetValue: 50,
  },
});

export const url = pulumi.interpolate`http://${alb.dnsName}`;
export const ecrRepositoryUrl = repo.repositoryUrl;
export const clusterName = cluster.name;
export const serviceName = service.name;
