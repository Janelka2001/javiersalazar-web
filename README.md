# javiersalazar.es

[![Project QA](https://github.com/Janelka2001/javiersalazar-web/actions/workflows/project-ci.yml/badge.svg)](https://github.com/Janelka2001/javiersalazar-web/actions/workflows/project-ci.yml)

Código fuente de [la web pública de fotografía de Javier Salazar](https://javiersalazar.es).

La web está construida con Astro y se publica como contenido estático en
Cloudflare Pages. Este repositorio contiene únicamente el sitio de producción;
los borradores editoriales, backups y credenciales se mantienen fuera de él.

## Desarrollo

Requisitos: Node.js 24.18.0 y npm.

```sh
npm ci
npm run dev
```

La web queda disponible en `http://localhost:4321`.

## Verificación

```sh
npm run qa
npm run qa:production
```

La rama `main` representa producción. Los cambios se realizan mediante pull
request y deben superar GitHub Actions y Cloudflare Pages antes de fusionarse.

## Derechos

Las fotografías, el logotipo, los textos y la identidad visual pertenecen a
Javier Salazar y no se distribuyen bajo una licencia abierta. Las dependencias
de terceros conservan sus respectivas licencias.
