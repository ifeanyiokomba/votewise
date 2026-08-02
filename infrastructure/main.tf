# VoteWise — Infrastructure as Code (Terraform)
# Production cloud infrastructure for VoteWise Election Platform.
# Deploy with: terraform init && terraform plan && terraform apply

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

variable "aws_region" { default = "eu-west-1" }
variable "project_name" { default = "votewise" }
variable "environment" { default = "production" }
variable "domain" { default = "votewise.com.ng" }
variable "db_password" { sensitive = true }

provider "aws" { region = var.aws_region }

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "${var.project_name}-${var.environment}"
  cidr    = "10.0.0.0/16"
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  enable_nat_gateway = true
}

# RDS PostgreSQL (Multi-AZ, encrypted, automated backups)
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-db"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.r6g.large"
  allocated_storage      = 100
  storage_encrypted      = true
  db_name                = "votewise"
  username               = "votewise"
  password               = var.db_password
  multi_az               = true
  backup_retention_period = 30
  deletion_protection    = true
  vpc_security_group_ids = [aws_security_group.db.id]
}

# ElastiCache Redis (Multi-AZ, encrypted)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-redis"
  description          = "VoteWise Redis"
  node_type            = "cache.r6g.large"
  number_cache_clusters = 2
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = true
}

# S3 Object Storage (versioned, encrypted)
resource "aws_s3_bucket" "storage" {
  bucket = "${var.project_name}-${var.environment}-storage"
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration { status = "Enabled" }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"
  setting { name = "containerInsights", value = "enabled" }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-app"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = module.vpc.vpc_id
  health_check { path = "/api/pihed/health", matcher = "200" }
}

# Route53 DNS
resource "aws_route53_zone" "main" { name = var.domain }

resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"
  alias { name = aws_lb.main.dns_name, zone_id = aws_lb.main.zone_id, evaluate_target_health = true }
}

# Security Groups
resource "aws_security_group" "alb" {
  name   = "${var.project_name}-alb"
  vpc_id = module.vpc.vpc_id
  ingress { from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 80, to_port = 80, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  egress { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "db" {
  name   = "${var.project_name}-db"
  vpc_id = module.vpc.vpc_id
  ingress { from_port = 5432, to_port = 5432, protocol = "tcp", cidr_blocks = ["10.0.0.0/16"] }
  egress { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}

# CloudWatch Alarm (auto-scaling trigger)
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
}

output "db_endpoint" { value = aws_db_instance.postgres.endpoint }
output "redis_endpoint" { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
output "alb_dns" { value = aws_lb.main.dns_name }
output "s3_bucket" { value = aws_s3_bucket.storage.bucket }
