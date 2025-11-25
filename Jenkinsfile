// Jenkinsfile - SSH → build on remote host → push to Docker Hub → deploy
pipeline {
  agent any
  environment {
    REMOTE = "deploy@54.169.161.25"               // <<-- เปลี่ยนเป็น user@IP ของ Docker host
    IMAGE  = "lattapon2540/ci-cd-web"            // <<-- เปลี่ยนเป็น <your-dockerhub-username>/repo
    SSH_CRED = "ssh-deploy-key"                  // <<-- Jenkins SSH credential id
    DOCKERHUB_CRED = "dockerhub-creds"           // <<-- Jenkins DockerHub credential id
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
        sshagent([env.SSH_CRED]) {
          sh """
            # create remote dir and clean old build files
            ssh -o StrictHostKeyChecking=no ${REMOTE} 'mkdir -p ${REMOTE_DIR} && rm -rf ${REMOTE_DIR}/*'
            # sync source (exclude .git and node_modules to save time)
            rsync -avz --delete --exclude='.git' --exclude='node_modules' . ${REMOTE}:${REMOTE_DIR}
          """
        }
      }
    }

    stage('Build & Push on Remote') {
      steps {
        sshagent([env.SSH_CRED]) {
          withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CRED, usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
            sh """
              # run the heavy tasks on remote host
              ssh -o StrictHostKeyChecking=no ${REMOTE} <<'EOF'
                set -e
                cd ${REMOTE_DIR}
                echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                docker build -t ${IMAGE}:${BUILD_NUMBER} .
                docker push ${IMAGE}:${BUILD_NUMBER}
                # update :latest tag (optional)
                docker tag ${IMAGE}:${BUILD_NUMBER} ${IMAGE}:latest || true
                docker push ${IMAGE}:latest || true
              EOF
            """
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        sshagent([env.SSH_CRED]) {
          sh """
            ssh -o StrictHostKeyChecking=no ${REMOTE} '
              set -e
              docker rm -f ci-cd-web || true
              docker pull ${IMAGE}:${BUILD_NUMBER}
              docker run -d --name ci-cd-web -p 3000:3000 ${IMAGE}:${BUILD_NUMBER}
            '
          """
        }
      }
    }

    stage('Healthcheck') {
      steps {
        sshagent([env.SSH_CRED]) {
          sh "ssh -o StrictHostKeyChecking=no ${REMOTE} 'docker ps --filter name=ci-cd-web --format \"{{.Names}} {{.Image}} {{.Status}}\"'"
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
