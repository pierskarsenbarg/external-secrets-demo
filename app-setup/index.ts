import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const stackref = new pulumi.StackReference(
  "pierskarsenbarg/esc-demo-k8s-setup/dev",
);
const secretStoreName = stackref.getOutput("secretStoreName");

const clusterSecretStoreKind = "ClusterSecretStore";

const appNamespace = new k8s.core.v1.Namespace("app-namespace");
const escSecret = new k8s.apiextensions.CustomResource(
  "mypassword-external-secret",
  {
    apiVersion: "external-secrets.io/v1beta1",
    kind: "ExternalSecret",
    metadata: {
      namespace: appNamespace.metadata.name,
    },
    spec: {
      refreshInterval: "1m",
      secretStoreRef: {
        kind: clusterSecretStoreKind,
        name: secretStoreName,
      },
      dataFrom: [
        {
          extract: {
            conversionStrategy: "Default",
            key: "app",
          },
        },
      ],
    },
  },
);

new k8s.helm.v4.Chart("podinfo", {
  chart: "podinfo",
  repositoryOpts: {
    repo: "https://stefanprodan.github.io/podinfo",
  },
  namespace: appNamespace.metadata.name,
  values: {
    extraEnvs: [
      {
        name: "FROM_ESC_PLAINTEXT",
        valueFrom: {
          secretKeyRef: {
            name: escSecret.metadata.name,
            key: "myplaintextvalue",
          },
        },
      },
      {
        name: "FROM_ESC_SECRET",
        valueFrom: {
          secretKeyRef: {
            name: escSecret.metadata.name,
            key: "mysecretpassword",
          },
        },
      },
    ],
  },
});
