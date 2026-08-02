# VoteWise — Staging environment
# Smaller instance sizes, single NAT gateway, lower replica counts.
# Apply with: terraform apply -var-file=tfvars/staging.tfvars

aws_region       = "eu-west-1"
project_name     = "votewise"
environment      = "staging"
domain           = "staging.votewise.com.ng"
db_instance_class = "db.t4g.medium"
redis_node_type  = "cache.t4g.small"
app_min_replicas = 2
app_max_replicas = 6
worker_min_replicas = 1
worker_max_replicas = 4
multi_az         = false
backup_retention_days = 7

# Pass via: -var="db_password=..." or TF_VAR_db_password env var
