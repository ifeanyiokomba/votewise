# VoteWise — Production environment
# Full HA, Multi-AZ, 3-AZ VPC, high replica ceilings for election-day scale.
# Apply with: terraform apply -var-file=tfvars/production.tfvars

aws_region       = "eu-west-1"
project_name     = "votewise"
environment      = "production"
domain           = "votewise.com.ng"
db_instance_class = "db.r6g.large"
redis_node_type  = "cache.r6g.large"
app_min_replicas = 3
app_max_replicas = 20
worker_min_replicas = 2
worker_max_replicas = 10
multi_az         = true
backup_retention_days = 30

# Pass via: -var="db_password=..." or TF_VAR_db_password env var (NEVER commit)
