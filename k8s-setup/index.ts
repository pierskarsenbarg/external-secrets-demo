import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const crds = new k8s.yaml.v2.ConfigFile("crd-yaml", {
  file: "./crds.yaml",
});

const secretsNamespace = new k8s.core.v1.Namespace("external-secrets");

const externalSecretsChart = new k8s.helm.v4.Chart(
  "external-secrets-chart",
  {
    namespace: secretsNamespace.metadata.name,
    chart: "external-secrets",
    repositoryOpts: {
      repo: "https://charts.external-secrets.io",
    },
    values: {
      installCRDs: false,
    },
  },
  { dependsOn: [crds] },
);

const secretStoreNs = new k8s.core.v1.Namespace("secret-store-ns");

const config = new pulumi.Config("pulumiservice");
const accessToken = config.requireSecret("accessToken");

// Real world we'd limit access to this secret via a service account
const accessTokenSecret = new k8s.core.v1.Secret("pulumi-access-token", {
  metadata: {
    namespace: secretStoreNs.metadata.name,
  },
  type: "Opaque",
  stringData: {
    accessToken: accessToken,
  },
});

const clusterSecretStore = new k8s.apiextensions.CustomResource(
  "cluster-secret-store",
  {
    apiVersion: "external-secrets.io/v1beta1",
    kind: "ClusterSecretStore",
    metadata: {
      namespace: secretStoreNs.metadata.name,
    },
    spec: {
      provider: {
        pulumi: {
          organization: "pierskarsenbarg",
          project: "demos",
          environment: "externalSecrets",
          accessToken: {
            secretRef: {
              name: accessTokenSecret.metadata.name,
              key: "accessToken",
              namespace: secretStoreNs.metadata.name,
            },
          },
        },
      },
    },
  },
  { dependsOn: [externalSecretsChart] },
);

export const secretStoreName = clusterSecretStore.metadata.name;
