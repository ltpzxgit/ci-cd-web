pipeline {
  agent any
  environment {
    REMOTE = "deploy@54.169.161.25"
    IMAGE  = "lattapon2540/ci-cd-web"
    SSH_CRED = "ssh-deploy-key"
    DOCKERHUB_CRED = "dockerhub-creds"
    REMOTE_DIR = "/home/deploy/app"
    // note: BUILD_NUMBER is runtime; we'll compute TAG in a stage and persist it to workspace
  }

  options {
    timestamps()
    timeout(time: 60, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // DEBUG: derive pubkey (run ONCE then REMOVE)
    stage('PrintPubKey - DEBUG (remove after use)') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY')]) {
          sh '''
            set -e
            echo "=== Sanitize key and show some diagnostics ==="
            tr -d '\\r' < "${SSH_KEY}" > "${SSH_KEY}.clean" || true
            mv "${SSH_KEY}.clean" "${SSH_KEY}" || true
            chmod 600 "${SSH_KEY}" || true

            echo "SSH client version:"
            ssh -V || true

            echo "File type and size:"
            file -b "${SSH_KEY}" || true
            stat -c "%n %s bytes" "${SSH_KEY}" || true

            if ssh-keygen -y -f "${SSH_KEY}" > /tmp/jenkins_pubkey.pub 2>/tmp/sshkey.err; then
              echo "---- BEGIN JENKINS DERIVED PUBLIC KEY ----"
              cat /tmp/jenkins_pubkey.pub
              echo "---- END JENKINS DERIVED PUBLIC KEY ----"
            else
              echo "ssh-keygen failed, show error:"
              cat /tmp/sshkey.err || true
              exit 1
            fi
          '''
        }
      }
    }

    stage('Prep remote dir & sync') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
          sh '''
            set -e
            tr -d '\\r' < "${SSH_KEY}" > "${SSH_KEY}.clean" || true
            mv "${SSH_KEY}.clean" "${SSH_KEY}" || true
            chmod 600 "${SSH_KEY}" || true

            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} "mkdir -p ${REMOTE_DIR} && rm -rf ${REMOTE_DIR}/*"

            RSYNC_SSH="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
            rsync -avz -e "$RSYNC_SSH" --delete --exclude='.git' --exclude='node_modules' . ${REMOTE}:${REMOTE_DIR}
          '''
        }
      }
    }

    stage('Build & Push on Remote') {
      steps {
        withCredentials([
          sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY'),
          usernamePassword(credentialsId: DOCKERHUB_CRED, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')
        ]) {
          sh '''
            set -e
            # sanitize key
            tr -d '\\r' < "${SSH_KEY}" > "${SSH_KEY}.clean" || true
            mv "${SSH_KEY}.clean" "${SSH_KEY}" || true
            chmod 600 "${SSH_KEY}" || true

            # compute TAG on Jenkins side (fallback to manual-BUILD_ID if BUILD_NUMBER empty)
            TAG="${BUILD_NUMBER}"
            if [ -z "$TAG" ]; then
              TAG="manual-${BUILD_ID}"
            fi
            echo "JENKINS: computed TAG=$TAG"
            # persist tag so Deploy stage can use the exact same value
            echo "$TAG" > ${WORKSPACE}/.deploy_tag

            # send commands to remote (Jenkins expands ${TAG}, ${IMAGE}, ${REMOTE_DIR} before sending)
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} <<EOF
set -e
cd ${REMOTE_DIR}

echo "REMOTE: Using TAG=${TAG}"
echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin

docker build -t ${IMAGE}:${TAG} .
docker push ${IMAGE}:${TAG}

# update latest tag
docker tag ${IMAGE}:${TAG} ${IMAGE}:latest || true
docker push ${IMAGE}:latest || true
EOF
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY')]) {
          sh '''
            set -e
            # read TAG computed earlier
            if [ -f ${WORKSPACE}/.deploy_tag ]; then
              TAG="$(cat ${WORKSPACE}/.deploy_tag)"
            else
              TAG="${BUILD_NUMBER}"
            fi
            echo "Deploying TAG=$TAG"

            chmod 600 "${SSH_KEY}" || true
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} <<EOF
set -e
docker rm -f ci-cd-web || true
docker pull ${IMAGE}:${TAG}
docker run -d --name ci-cd-web -p 3000:3000 --restart unless-stopped ${IMAGE}:${TAG}
EOF
          '''
        }
      }
    }

    stage('Healthcheck') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY')]) {
          sh '''
            TAG=""
            if [ -f ${WORKSPACE}/.deploy_tag ]; then
              TAG="$(cat ${WORKSPACE}/.deploy_tag)"
            else
              TAG="${BUILD_NUMBER}"
            fi
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} "docker ps --filter name=ci-cd-web --format '{{.Names}} {{.Image}} {{.Status}}' | grep ci-cd-web || true"
            echo "Healthcheck done for ${IMAGE}:${TAG}"
          '''
        }
      }
    }
  }

  post {
    success { echo "Pipeline ${env.BUILD_NUMBER} succeeded!" }
    failure { echo "Pipeline ${env.BUILD_NUMBER} failed — check console output." }
  }
}
