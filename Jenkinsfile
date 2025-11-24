pipeline {
  agent any

  environment {
    IMAGE = "yourdockerhubuser/ci-cd-web"
    TAG = "${env.BUILD_ID}"
    SERVER = "ubuntu@YOUR_SERVER_IP"
    DEPLOY_DIR = "/home/ubuntu/ci-cd-web"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build & Push Image') {
      steps {
        withCredentials([usernamePassword(
            credentialsId: 'dockerhub-creds',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
        )]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            docker build -t ${IMAGE}:${TAG} .
            docker push ${IMAGE}:${TAG}
          '''
        }
      }
    }

    stage('Deploy to Server') {
      steps {
        sshagent(['webserver-ssh']) {
          sh '''
            ssh -o StrictHostKeyChecking=no ${SERVER} "mkdir -p ${DEPLOY_DIR}"
            ssh ${SERVER} "echo TAG=${TAG} > ${DEPLOY_DIR}/.env"
            ssh ${SERVER} "cd ${DEPLOY_DIR} && docker compose pull && docker compose up -d --force-recreate"
          '''
        }
      }
    }

  }
}