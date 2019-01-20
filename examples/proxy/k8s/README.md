# Apiql-express proxy demo
The following outlines steps to deploy the proxy demo on kubernetes.

## Setup
```
$ cd path/to/examples/proxy/k8s
$ kubectl apply -f star-wars.yaml
$ kubectl apply -f apiql-proxy.yaml
```

>Note: If you are using a kubernetes cluster that supports loadbalancers, you can modify the apiql-proxy.yaml configuration per
the comments in the file.

## Trying it out

Using `kubectl proxy`, in one terminal run:

```
$ kubectl proxy
Starting to serve on 127.0.0.1:8001
```

And in another terminal:
```
$ export APIQL_HOST=http://localhost:8001/api/v1/namespaces/default/services/apiql-express/proxy
```

And then you can follow the [Trying It Out](../../../README.md#trying-it-out) examples.

## Tearing it down

```
$ kubectl delete service -l app=apiql
$ kubectl delete deployment -l app=apiql
$ kubectl delete service -l app=star-wars
$ kubectl delete deployment -l app=star-wars
```
