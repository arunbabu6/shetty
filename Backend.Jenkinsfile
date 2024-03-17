pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'annesh/pro-v2'
        SONARQUBE_TOKEN = credentials('sonar-docker')
        DOCKERHUB_CREDENTIALS = credentials('dockerhub1')
        // SSH credentials for each environment
        PROJECT_DIR = '/opt/docker-shetty'
    }

    stages {
        stage('Setup') {
            agent any
            steps {
                script {
                    env.ENVIRONMENT = BRANCH_NAME == 'main' ? 'Demo' :
                                  BRANCH_NAME == 'production' ? 'Production' :
                                  BRANCH_NAME == 'staging' ? 'Staging' :
                                  BRANCH_NAME.startsWith('test') ? 'Testing' : 'Development'
                    echo "Environment set to ${env.ENVIRONMENT}"
                }
            }
        }

        stage('Checkout Code') {
            agent any
            steps {
                checkout scm
            }
        }

        stage('Clean Workspace') {
            agent any
            steps {
                 script {
                    if (fileExists('.')) {
                        deleteDir()
                    } else {
                        echo "Workspace directory does not exist, no need to delete."
                    }
                 }
             }
        }

        stage('Use Artifacts') {
            agent any
            steps {
                script {
                    if (currentBuild.previousBuild != null && currentBuild.previousBuild.result == 'SUCCESS') {
                        try { 
                            copyArtifacts(projectName: "AnishProject/main", selector: lastSuccessful(), filter: 'lint-results.txt');
                        } catch (Exception e) {
                            echo "Warning: Failed to copy artifacts. Proceeding without them."
                        }
                    } else {
                        echo "No previous successful build found. Skipping artifact copy."
                    }
                }
            }
        }

        stage('Stash Client') {
            agent any
            steps {
                dir('WWA-backend-master') {
                    stash includes: '**', name: 'backendshetty-src'
                }
            }
        }

        stage('Prepare and Build') {
            agent any
            steps {
                script {
                    unstash 'backendshetty-src'
                    dir('WWA-backend-master') {
                        // Assuming the build commands are here [ @Chandan verify this]
                       // sh 'cp ${WORKSPACE}/.env .'
                        sh 'npm install'
                        //sh 'node index.js'
                        // Stash the build artifacts, excluding the node_modules directory
                        stash excludes: 'node_modules/**', includes: '**', name: 'build-artifacts3'
                    }
                }
            }
        }

        // SonarQube Analysis and Snyk Security Scan 
        stage('SonarQube Analysis') {
            agent any
            steps {
                withSonarQubeEnv('Sonarqube') { // 'Sonarcube-cred' from |should match the SonarQube configuration in Jenkins
                    sh """
                      sonar-scanner \
                      -Dsonar.projectKey=Project-Shetty \
                      -Dsonar.sources=. \
                      -Dsonar.host.url=http://172.19.0.4:9000/ \
                      -Dsonar.login=$SONARQUBE_TOKEN
                    """
                }
            }
        }

        stage('Snyk Security Scan') {
            agent any
            steps {
                dir('client') {
        //        snykSecurity failOnError: false, failOnIssues: false, organisation: 'arunbabu6', projectName: 'For-Green2', snykInstallation: 'Snyk', snykTokenId: 'snyk-token', targetFile: 'package.json'
                snykSecurity failOnError: false, failOnIssues: false, organisation: 'arunbabu6', projectName: 'For-Shetty', snykInstallation: 'Snyk', snykTokenId: 'snyk-token'
                }

            }
        }

        stage('Lint') {
            agent any
            steps {
                dir('WWA-backend-master') { 
                                // Execute the lint script and allow the build not to fail on lint errors
                  script {
                     // Run lint script and capture the exit code
                     def lintExitCode = sh(script: 'npm run lint:ci || true', returnStatus: true)

                     // Check if the lint report exists
                      if (fileExists('eslint-report.xml')) {
                     // Archive the eslint report
                          archiveArtifacts artifacts: 'eslint-report.json', onlyIfSuccessful: true
                    } else {
                          echo "No eslint-report.xml found"
                    }

                // If the lint script exited with an error (non-zero exit code), fail the build
                      if (lintExitCode != 0) {
                           error("Linting failed with exit code: ${lintExitCode}")
                     }
                   }
               }
           }
        }

        stage('Build and Push Docker Image') {
            agent any
            steps {
                script {
                    // Create a directory 'artifacts' in the Jenkins workspace to hold the unstashed files
                    sh "mkdir -p artifacts3"
                    dir('artifacts3') {
                        // Unstash the build artifacts into this 'artifacts' directory
                        unstash 'build-artifacts3'
                        }
                        sshagent(['jenkinaccess']) {
                            // Clear the 'artifacts' directory on the Docker host
                            sh "ssh ab@host.docker.internal 'rm -rf ${PROJECT_DIR}/artifacts/*'"
                            sh "scp -rp artifacts2/* ab@host.docker.internal:${PROJECT_DIR}/artifacts/"
                            // Build the Docker image on the Docker host
                            sh "ssh ab@host.docker.internal 'cd ${PROJECT_DIR} && docker build -t ${env.DOCKER_IMAGE}-backend-shetty:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} .'"
                        }
                        // Log in to DockerHub and push the image
                        withCredentials([usernamePassword(credentialsId: 'dockerhub1', usernameVariable: 'DOCKER_USERNAME', passwordVariable: 'DOCKER_PASSWORD')]) {
                            sh """
                                echo '${DOCKER_PASSWORD}' | ssh ab@host.docker.internal 'docker login -u ${DOCKER_USERNAME} --password-stdin' > /dev/null 2>&1
                                ssh ab@host.docker.internal 'docker push ${env.DOCKER_IMAGE}-backend-shetty:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}'
                            """
                        }

                    }
            }
        }

        stage('Trivy Vulnerability Scan') {
            agent any
            steps {
                script {
                    // Wrapping the SSH commands in a single SSH session
                    sshagent(['jenkinaccess']) {
                        // Execute Trivy scan and echo the scanning process
                        sh "ssh ab@host.docker.internal 'trivy image --download-db-only && \
                        echo \"Scanning ${env.DOCKER_IMAGE}-backend-shetty:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} with Trivy...\" && \
                        trivy image --format json --output \"/opt/docker-shetty/Trivy/trivy-report--${env.BUILD_NUMBER}.json\" ${env.DOCKER_IMAGE}-backend-shetty:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}'"
                        // Correctly execute scp within a sh command block
                        sh "scp ab@host.docker.internal:/opt/docker-aneesh/Trivy/trivy-report--${env.BUILD_NUMBER}.json ."

                        // Use double quotes for string interpolation
                        archiveArtifacts artifacts: "trivy-report--${env.BUILD_NUMBER}.json", onlyIfSuccessful: true
                    }
                }
            }
        }

        stage('Deploy') {      
            agent any  
            steps {
                script {
                    switch (ENVIRONMENT) {
                        case 'Demo':
                            sshagent(['jenkinaccess']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no ab@host.docker.internal '
                                    docker pull ${env.DOCKER_IMAGE}-backend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} &&
                                    docker stop projectname-shettybackend || true &&
                                    docker rm projectname-shettybackend || true &&
                                    docker run -d --name projectname-shettybackend -p 8091:80 ${env.DOCKER_IMAGE}-backend-shetty:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}
                                    '
                            """
                            }
                            break
                            
                        case 'Testing':
                            sshagent(['jenkinaccess']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no ab@Testing-host.docker.internal '
                                    docker pull ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} &&
                                    docker stop projectname-frontend || true &&
                                    docker rm projectname-frontend || true &&
                                    docker run -d --name projectname-frontend -p 8090:80 ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}
                                    '
                            """
                            }
                            break
                           
                        case 'Staging':
                            sshagent(['jenkinaccess']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no ab@Staging-host.docker.internal '
                                    docker pull ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} &&
                                    docker stop projectname-frontend || true &&
                                    docker rm projectname-frontend || true &&
                                    docker run -d --name projectname-frontend -p 8090:80 ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}
                                    '
                                    """
                                }
                            break
                            
                        case 'Production':
                            sshagent(['jenkinaccess']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no ab@Production-host.docker.internal '
                                    docker pull ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER} &&
                                    docker stop projectname-frontend || true &&
                                    docker rm projectname-frontend || true &&
                                    docker run -d --name projectname-frontend -p 8090:80 ${env.DOCKER_IMAGE}-frontend:${env.ENVIRONMENT.toLowerCase()}-${env.BUILD_NUMBER}
                                    '
                            """
                            }
                            break
                            
                        default:
                            echo "Environment configuration not found"
                            return

                    }

                }
            }
        }
    }

    post {
        always {
            script{
                   
                if (env.ENVIRONMENT) {
                    echo "Pipeline execution completed for ${env.ENVIRONMENT}"
                } else {
                    echo "Pipeline execution completed, but ENVIRONMENT was not set."
                }
            }
        }
    }
}
