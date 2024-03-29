import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AwsGreengrassEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const numClients = this.node.tryGetContext('NumClients') || 2;

    const vpc = new ec2.Vpc(this, 'GreengrassVPC', {
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'GreengrassSG', {
      vpc: vpc,
      description: 'Greengrass instance security group',
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8883), 'MQTT Communications');

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'amazon-linux-extras install java-openjdk11',
      'useradd --system --create-home ggc_user',
      'groupadd --system ggc_group',
      'echo "root ALL=(ALL:ALL) ALL" | sudo EDITOR="tee -a" visudo',
      'amazon-linux-extras install docker',
      'service docker start',
      'usermod -a -G docker ec2-user',
      'usermod -a -G docker ggc_user',
      'chkconfig docker on'
    );

    const policyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            'iam:AttachRolePolicy',
            'iam:CreatePolicy',
            'iam:CreateRole',
            'iam:GetPolicy',
            'iam:GetRole',
            'iam:PassRole',
            'iot:AddThingToThingGroup',
            'iot:AttachPolicy',
            'iot:AttachThingPrincipal',
            'iot:CreateKeysAndCertificate',
            'iot:CreatePolicy',
            'iot:CreateRoleAlias',
            'iot:CreateThing',
            'iot:CreateThingGroup',
            'iot:DescribeEndpoint',
            'iot:DescribeRoleAlias',
            'iot:DescribeThingGroup',
            'iot:GetPolicy',
            'greengrass:CreateDeployment',
            'iot:CancelJob',
            'iot:CreateJob',
            'iot:DeleteThingShadow',
            'iot:DescribeJob',
            'iot:DescribeThing',
            'iot:DescribeThingGroup',
            'iot:GetThingShadow',
            'iot:UpdateJob',
            'iot:UpdateThingShadow',
            's3:GetObject',
          ],
          resources: ['*'],
        }),
      ],
    });

    const managedPolicy = new iam.ManagedPolicy(this, 'GreengrassManagedPolicy', {
      description: 'Managed policy for Greengrass',
      document: policyDocument,
    });

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Greengrass EC2 client role',
      managedPolicies: [managedPolicy],
    });

    for (let i = 0; i < numClients; i++) {
      new ec2.Instance(this, `HFL/Client${i + 1}`, {
        vpc: vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.M7G, ec2.InstanceSize.LARGE),
        machineImage: ec2.MachineImage.latestAmazonLinux({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
          cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        }),
        role: role,
        ssmSessionPermissions: true,
        securityGroup: securityGroup,
        userData: userData,
      });
    }
  }
}
