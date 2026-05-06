# Strapi - Visão Geral Técnica

Strapi é um CMS headless baseado em Node.js que oferece uma API escalável e customizável. Diferencia-se de CMS tradicionais por separar completamente a camada de conteúdo da apresentação, entregando dados via REST ou GraphQL.

## Conceitos Centrais

### Content-Types
Definem a estrutura de dados do sistema. Existem três tipos: Collection Type (coleções de documentos), Single Type (um único documento) e Component (estruturas reutilizáveis).

### Document API
API moderna de Strapi 4+ que oferece operações CRUD para criar, buscar, atualizar e deletar documentos de forma estruturada.

### Lifecycle Hooks
Interceptam operações de banco de dados em diferentes estágios. Os principais hooks são beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterFind e afterFindMany. Permitem validação, normalização, criptografia e auditoria.

### Controllers
Camada de entrada HTTP. Validam requisições, chamam serviços correspondentes, formatam respostas HTTP e redirecionam erros.

### Services
Implementam a lógica de negócio. Orquestram múltiplas operações, implementam regras de negócio, interagem com Document API e não conhecem contexto HTTP.

### Rotas
Definem endpoints HTTP mapeando para controllers. Indicam método (GET, POST, etc), caminho, handler e policies aplicáveis.

### Policies
Middleware customizado para autorização e validação. Determinam se uma requisição pode ou não acessar um recurso.

### Middleware Global
Executado em todas as requisições antes de chegar ao controller. Exemplos: logger, CORS, autenticação, compressão.

## Fluxo de Requisição

Uma requisição passa por: logger, CORS, autenticação, roteamento, policies, controller, service, lifecycle hooks, banco de dados, lifecycle hooks novamente, service, controller e finalmente retorna a resposta HTTP.

## Vantagens

Estrutura organizada com separação clara entre camadas. Segurança integrada com middleware, policies e validação. Escalabilidade ao adicionar novos content-types. Auditoria automática via lifecycles. Suporte a criptografia em lifecycles. Admin UI para gerenciar dados.

## Desvantagens

Overhead de framework em relação ao Express puro. Curva de aprendizado. Documentação em constante evolução.

