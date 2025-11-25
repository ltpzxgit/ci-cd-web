pipeline {
  agent any
  environment {
    REMOTE = "deploy@54.169.161.25"
    IMAGE  = "lattapon2540/ci-cd-web"
    SSH_CRED = "ssh-deploy-key"
    DOCKERHUB_CRED = "dockerhub-creds"
    REMOTE_DIR = "/home/deploy/app"
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    // DEBUG: sanitize + derive pubkey (run ONCE, then remove)
    stage('PrintPubKey - DEBUG (remove after use)') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY')]) {
          sh '''
            set -e
            echo "=== Sanitize key and show some diagnostics ==="
            # remove CR (\r) if any
            tr -d '\\r' < "${SSH_KEY}" > "${SSH_KEY}.clean" || true
            mv "${SSH_KEY}.clean" "${SSH_KEY}" || true
            chmod 600 "${SSH_KEY}" || true

            echo "SSH client version:"
            ssh -V || true

            echo "File type and size:"
            file -b "${SSH_KEY}" || true
            stat -c "%n %s bytes" "${SSH_KEY}" || true

            # derive public key
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
            # sanitize key again just in case
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
            tr -d '\\r' < "${SSH_KEY}" > "${SSH_KEY}.clean" || true
            mv "${SSH_KEY}.clean" "${SSH_KEY}" || true
            chmod 600 "${SSH_KEY}" || true

            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} <<EOF
  set -e
  cd ${REMOTE_DIR}

  # debug output
  echo "DEBUG: IMAGE='${IMAGE}'"
  echo "DEBUG: BUILD_NUMBER='${BUILD_NUMBER}'"
  echo "DEBUG: DH_USER='${DH_USER}'"

  # fallback tag if BUILD_NUMBER empty
  TAG="${BUILD_NUMBER:-manual-${BUILD_ID}}"
  echo "Using TAG=\$TAG"

  # docker login
  echo "${DH_PASS}" | docker login -u "${DH_USER}" --password-stdin

  # build & push with safe tag
  docker build -t ${IMAGE}:\$TAG .
  docker push ${IMAGE}:\$TAG

  # update latest tag
  docker tag ${IMAGE}:\$TAG ${IMAGE}:latest || true
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
            chmod 600 "${SSH_KEY}" || true
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} <<'EOF'
              set -e
              docker rm -f ci-cd-web || true
              docker pull ${IMAGE}:${BUILD_NUMBER}
              docker run -d --name ci-cd-web -p 3000:3000 ${IMAGE}:${BUILD_NUMBER}
            EOF
          '''
        }
      }
    }

    stage('Healthcheck') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY')]) {
          sh 'ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} "docker ps --filter name=ci-cd-web --format \\"{{.Names}} {{.Image}} {{.Status}}\\""'
        }
      }
    }
  }

  post {
    success { echo "Pipeline ${env.BUILD_NUMBER} succeeded!" }
    failure { echo "Pipeline ${env.BUILD_NUMBER} failed — check console output." }
  }
}
