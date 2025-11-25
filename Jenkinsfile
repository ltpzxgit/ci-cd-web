// Jenkinsfile - no ssh-agent plugin (uses sshUserPrivateKey + dockerhub creds)
pipeline {
  agent any
  environment {
    REMOTE = "deploy@54.169.161.25"            // user@host ของ remote
    IMAGE  = "lattapon2540/ci-cd-web"          // dockerhub repo
    SSH_CRED = "ssh-deploy-key"                // Jenkins SSH credential id (SSH Username with private key)
    DOCKERHUB_CRED = "dockerhub-creds"         // Jenkins DockerHub credential id
    REMOTE_DIR = "/home/deploy/app"
  }

  stages {
    stage('Checkout from GitHub') {
      steps {
        checkout scm
      }
    }

    stage('Prep remote dir & sync') {
      steps {
        // get path to key on agent (or temp file provided by Jenkins)
        withCredentials([sshUserPrivateKey(credentialsId: SSH_CRED, keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
          sh '''
            set -e
            chmod 600 "${SSH_KEY}" || true

            # Ensure remote dir and clean it
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} "mkdir -p ${REMOTE_DIR} && rm -rf ${REMOTE_DIR}/*"

            # rsync source to remote (exclude .git, node_modules)
            rsync -avz -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" --delete --exclude='.git' --exclude='node_modules' . ${REMOTE}:${REMOTE_DIR}
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
            chmod 600 "${SSH_KEY}" || true

            # run build & push on remote host
            ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${REMOTE} <<'EOF'
              set -e
              cd ${REMOTE_DIR}

              # Docker login using creds from Jenkins
              echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin

              # Build and push tagged image
              docker build -t ${IMAGE}:${BUILD_NUMBER} .
              docker push ${IMAGE}:${BUILD_NUMBER}

              # update latest tag (optional)
              docker tag ${IMAGE}:${BUILD_NUMBER} ${IMAGE}:latest || true
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
    success {
      echo "Pipeline ${env.BUILD_NUMBER} succeeded!"
    }
    failure {
      echo "Pipeline ${env.BUILD_NUMBER} failed — check console output."
    }
  }
}
