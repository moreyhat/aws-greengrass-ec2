import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class AwsGreengrassEc2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
      'adduser --system ggc_user',
      'groupadd --system ggc_group',
      'curl https://raw.githubusercontent.com/tianon/cgroupfs-mount/951c38ee8d802330454bdede20d85ec1c0f8d312/cgroupfs-mount > cgroupfs-mount.sh',
      'chmod +x cgroupfs-mount.sh',
      'bash ./cgroupfs-mount.sh',
      'yum install -y java-1.8.0-openjdk',
      'mkdir greengrass-dependency-checker-GGCv1.11.x',
      'cd greengrass-dependency-checker-GGCv1.11.x',
      'wget https://github.com/aws-samples/aws-greengrass-samples/raw/master/greengrass-dependency-checker-GGCv1.11.x.zip',
      'unzip greengrass-dependency-checker-GGCv1.11.x.zip',
      'cd greengrass-dependency-checker-GGCv1.11.x',
      'sudo ./check_ggc_dependencies | more'
    );

    const instance = new ec2.Instance(this, 'GreengrassInstance', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      ssmSessionPermissions: true,
      securityGroup: securityGroup,
      userData: userData,
    });
  }
}
