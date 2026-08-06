#!/usr/bin/env bash
# Imperative provisioning for the single t3.micro box (Life OS agent + Jira MCP).
# One box stays within the free-tier 750 shared instance-hours, so this is the $0 path.
#
# Usage:
#   ./provision.sh                 # launch (idempotent: reuses keypair/SG if present)
#   SSH_SOURCE=203.0.113.0/32 ./provision.sh   # lock SSH to a different CIDR
#
# Creates/looks up:
#   - keypair             lifeos-box        (.pem written, chmod 600)
#   - security group      lifeos-box-sg     (SSH/22 from $SSH_SOURCE only)
#   - instance            t3.micro          Ubuntu 24.04 amd64, 2GB swap via user-data
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AWS="$ROOT/aws.sh"

REGION="${REGION:-us-east-1}"
NAME="lifeos-box"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
# Ubuntu 24.04 LTS amd64 (hvm-ssd-gp3), latest as of 2026-07-14.
AMI="${AMI:-ami-052355af2a014bd2c}"
SWAP_GB="${SWAP_GB:-2}"
SSH_SOURCE="${SSH_SOURCE:-122.171.23.95/32}"
KEY_NAME="${KEY_NAME:-lifeos-box}"
SG_NAME="${SG_NAME:-lifeos-box-sg}"
PEM="$ROOT/deploy/ec2-single-box/$KEY_NAME.pem"

echo "==> [1/4] Keypair: $KEY_NAME"
if "$AWS" ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "    keypair already exists ($KEY_NAME); reusing"
  if [[ ! -f "$PEM" ]]; then
    echo "    ! $PEM missing (AWS keeps only the public half). Regenerate by deleting"
    echo "      the keypair ('$AWS ec2 delete-key-pair --key-name $KEY_NAME') then re-run."
    exit 1
  fi
else
  "$AWS" ec2 create-key-pair --key-name "$KEY_NAME" --key-type rsa --region "$REGION" \
    --query 'KeyMaterial' --output text > "$PEM"
  chmod 600 "$PEM"
  echo "    created keypair; private key -> $PEM"
fi

echo "==> [2/4] Security group: $SG_NAME"
SG_ID="$("$AWS" ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=$SG_NAME" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  SG_ID="$("$AWS" ec2 create-security-group --group-name "$SG_NAME" \
    --description "Life OS single box (agent + Jira MCP); SSH only" \
    --region "$REGION" --query 'GroupId' --output text)"
  "$AWS" ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "$SSH_SOURCE" --region "$REGION" >/dev/null
  echo "    created $SG_ID, SSH/22 from $SSH_SOURCE"
else
  echo "    reusing $SG_ID"
fi

SUB_ID="$("$AWS" ec2 describe-subnets --region "$REGION" \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[0].SubnetId' --output text)"

echo "==> [3/4] Launching t3.micro (AMI $AMI) with ${SWAP_GB}G swap"
EXISTING="$("$AWS" ec2 describe-instances --region "$REGION" \
  --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[*].Instances[*].InstanceId' --output text)"
if [[ -n "$EXISTING" ]]; then
  echo "    instance already exists ($EXISTING); reusing (no second box -> no second bill)."
  INSTANCE_ID="$(echo "$EXISTING" | tr -s ' ' '\n' | head -n1)"
else
INSTANCE_ID="$("$AWS" ec2 run-instances \
  --image-id "$AMI" \
  --instance-type "$INSTANCE_TYPE" \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --subnet-id "$SUB_ID" \
  --associate-public-ip-address \
  --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":8,\"VolumeType\":\"gp2\",\"DeleteOnTermination\":true}}]" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=Purpose,Value=lifeos-agent-and-mcp}]" \
  --user-data "$(cat <<EOF
#cloud-config
runcmd:
  - fallocate -l ${SWAP_GB}G /swapfile
  - chmod 600 /swapfile
  - mkswap /swapfile
  - swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab
  - sysctl vm.swappiness=10
  - echo 'vm.swappiness=10' >> /etc/sysctl.d/99-swap.conf
EOF
)" \
  --region "$REGION" \
  --query 'Instances[0].InstanceId' --output text)"
fi

echo "==> [4/4] Waiting for $INSTANCE_ID to reach 'running'"
"$AWS" ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

PUBIP="$("$AWS" ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"

echo
echo "=== DONE ==="
echo "  Instance : $INSTANCE_ID   ($INSTANCE_TYPE, us-east-1)"
echo "  Public IP: $PUBIP"
echo "  Key      : $PEM"
echo "  Swap     : ${SWAP_GB}G enabled via cloud-init; verify with:"
echo "             ssh -i $PEM ubuntu@$PUBIP 'swapon --show; free -h'"
