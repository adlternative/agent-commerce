import { defineConfig } from 'vitepress'

/** Project Pages default; override with DOCS_BASE=/ for root hosting. */
const base = process.env.DOCS_BASE ?? '/agent-commerce/'

export default defineConfig({
  title: 'Agent Commerce',
  description: 'AI-native commerce: HTTP API + MCP + customer/merchant UI',
  base,
  lang: 'zh-CN',
  cleanUrls: true,
  ignoreDeadLinks: [
    // Raw OpenAPI is served as a static asset, not a VitePress page.
    /\.json$/,
  ],
  themeConfig: {
    nav: [
      { text: 'Getting Started', link: '/' },
      { text: '产品价值', link: '/product/POSITIONING' },
      { text: '接入指南', link: '/product/INTEGRATION' },
      { text: 'API & MCP', link: '/reference/' },
      { text: 'ADR', link: '/engineering/adr/README' },
      { text: '部署', link: '/deploy' },
      {
        text: 'GitHub',
        link: 'https://github.com/adlternative/agent-commerce',
      },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: '快速开始', link: '/' },
          { text: '架构概览', link: '/ARCHITECTURE' },
          { text: 'AI 集成', link: '/AI-INTEGRATION' },
        ],
      },
      {
        text: '产品价值',
        items: [
          { text: '定位', link: '/product/POSITIONING' },
          { text: '为何开源', link: '/product/WHY-OPEN' },
          { text: '对比', link: '/product/COMPARISON' },
        ],
      },
      {
        text: '接入指南',
        items: [
          { text: '三条接入路径', link: '/product/INTEGRATION' },
          { text: 'HTTP API 说明', link: '/API' },
          { text: 'MCP 说明', link: '/MCP' },
        ],
      },
      {
        text: 'API & MCP 参考',
        items: [
          { text: '概览', link: '/reference/' },
          { text: 'API（OpenAPI 生成）', link: '/reference/api.generated' },
          { text: 'MCP Tools（代码生成）', link: '/reference/mcp-tools.generated' },
        ],
      },
      {
        text: 'ADR',
        items: [
          { text: '索引', link: '/engineering/adr/README' },
          { text: '0001 Zod → OpenAPI', link: '/engineering/adr/0001-zod-single-validation-source' },
          { text: '0002 JSON then SQLite', link: '/engineering/adr/0002-json-then-sqlite-dual-backend' },
          { text: '0003 Shared domain service', link: '/engineering/adr/0003-shared-domain-service-rest-mcp' },
          { text: '0004 Fail-closed auth', link: '/engineering/adr/0004-fail-closed-auth-jwt-api-key' },
          { text: '0005 Integer cents', link: '/engineering/adr/0005-integer-cents' },
          { text: '0006 E2E isomorphic', link: '/engineering/adr/0006-e2e-isomorphic-with-prod' },
          { text: '0007 VitePress docs site', link: '/engineering/adr/0007-vitepress-docs-site' },
        ],
      },
      {
        text: '工程与部署',
        items: [
          { text: '贡献规范', link: '/engineering/CONTRIBUTING' },
          { text: '安全', link: '/engineering/SECURITY' },
          { text: '应用部署', link: '/architecture/DEPLOYMENT' },
          { text: '基础设施', link: '/architecture/INFRA' },
          { text: '文档站（Pages）', link: '/deploy' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/adlternative/agent-commerce' },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/adlternative/agent-commerce/edit/main/docs/:path',
      text: 'Edit this page',
    },
    footer: {
      message: 'Agent Commerce docs — generated API/MCP refs from OpenAPI + code',
      copyright: 'Open source · self-hosted',
    },
  },
})
