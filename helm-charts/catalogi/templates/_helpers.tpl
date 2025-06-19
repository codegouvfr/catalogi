{{/*
Expand the name of the chart.
*/}}
{{- define "catalogi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "catalogi.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "catalogi.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "catalogi.labels" -}}
helm.sh/chart: {{ include "catalogi.chart" . }}
{{ include "catalogi.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "catalogi.selectorLabels" -}}
app.kubernetes.io/name: {{ include "catalogi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "catalogi.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "catalogi.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Web component labels
*/}}
{{- define "catalogi.web.labels" -}}
{{ include "catalogi.labels" . }}
app.kubernetes.io/component: web
{{- end }}

{{/*
Web selector labels
*/}}
{{- define "catalogi.web.selectorLabels" -}}
{{ include "catalogi.selectorLabels" . }}
app.kubernetes.io/component: web
{{- end }}

{{/*
API component labels
*/}}
{{- define "catalogi.api.labels" -}}
{{ include "catalogi.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
API selector labels
*/}}
{{- define "catalogi.api.selectorLabels" -}}
{{ include "catalogi.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Update component labels
*/}}
{{- define "catalogi.update.labels" -}}
{{ include "catalogi.labels" . }}
app.kubernetes.io/component: update
{{- end }}

{{/*
Database connection string
*/}}
{{- define "catalogi.databaseUrl" -}}
{{- if .Values.database.externalHost -}}
postgresql://{{ .Values.database.user }}:{{ .Values.database.password }}@{{ .Values.database.externalHost }}:5432/{{ .Values.database.db }}
{{- else if .Values.postgresql.enabled -}}
postgresql://{{ .Values.database.user }}:{{ .Values.database.password }}@{{ include "catalogi.fullname" . }}-postgresql:5432/{{ .Values.database.db }}
{{- else -}}
{{- fail "Either postgresql.enabled must be true or database.externalHost must be set" -}}
{{- end -}}
{{- end }}

{{/*
Get image tag
*/}}
{{- define "catalogi.imageTag" -}}
{{- .image.tag | default .root.Chart.AppVersion -}}
{{- end }}

{{/*
API Environment variables
*/}}
{{- define "catalogi.apiEnvs" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.existingSecret | default (printf "%s-database" (include "catalogi.fullname" .)) }}
      key: database-url
- name: API_PORT
  value: "3000"
- name: EXTERNAL_SOFTWARE_DATA_ORIGIN
  value: "wikidata"
{{- range $key, $value := .Values.api.env }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}