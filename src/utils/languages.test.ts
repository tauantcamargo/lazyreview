import { describe, it, expect } from 'vitest'
import { getLanguageFromFilename } from './languages'

describe('getLanguageFromFilename', () => {
  describe('JavaScript / TypeScript', () => {
    it('returns typescript for .ts files', () => {
      expect(getLanguageFromFilename('src/index.ts')).toBe('typescript')
    })

    it('returns typescript for .tsx files', () => {
      expect(getLanguageFromFilename('Component.tsx')).toBe('typescript')
    })

    it('returns typescript for .mts files', () => {
      expect(getLanguageFromFilename('config.mts')).toBe('typescript')
    })

    it('returns typescript for .cts files', () => {
      expect(getLanguageFromFilename('config.cts')).toBe('typescript')
    })

    it('returns javascript for .js files', () => {
      expect(getLanguageFromFilename('utils.js')).toBe('javascript')
    })

    it('returns javascript for .jsx files', () => {
      expect(getLanguageFromFilename('App.jsx')).toBe('javascript')
    })

    it('returns javascript for .mjs files', () => {
      expect(getLanguageFromFilename('config.mjs')).toBe('javascript')
    })

    it('returns javascript for .cjs files', () => {
      expect(getLanguageFromFilename('config.cjs')).toBe('javascript')
    })
  })

  describe('Web languages', () => {
    it('returns html for .html files', () => {
      expect(getLanguageFromFilename('index.html')).toBe('html')
    })

    it('returns html for .htm files', () => {
      expect(getLanguageFromFilename('page.htm')).toBe('html')
    })

    it('returns css for .css files', () => {
      expect(getLanguageFromFilename('styles.css')).toBe('css')
    })

    it('returns scss for .scss files', () => {
      expect(getLanguageFromFilename('theme.scss')).toBe('scss')
    })

    it('returns less for .less files', () => {
      expect(getLanguageFromFilename('vars.less')).toBe('less')
    })

    it('returns graphql for .graphql files', () => {
      expect(getLanguageFromFilename('schema.graphql')).toBe('graphql')
    })

    it('returns graphql for .gql files', () => {
      expect(getLanguageFromFilename('query.gql')).toBe('graphql')
    })
  })

  describe('Data / Config formats', () => {
    it('returns json for .json files', () => {
      expect(getLanguageFromFilename('package.json')).toBe('json')
    })

    it('returns yaml for .yaml files', () => {
      expect(getLanguageFromFilename('config.yaml')).toBe('yaml')
    })

    it('returns yaml for .yml files', () => {
      expect(getLanguageFromFilename('ci.yml')).toBe('yaml')
    })

    it('returns toml for .toml files', () => {
      expect(getLanguageFromFilename('Cargo.toml')).toBe('toml')
    })

    it('returns xml for .xml files', () => {
      expect(getLanguageFromFilename('pom.xml')).toBe('xml')
    })

    it('returns xml for .svg files', () => {
      expect(getLanguageFromFilename('icon.svg')).toBe('xml')
    })

    it('returns xml for .xsl files', () => {
      expect(getLanguageFromFilename('transform.xsl')).toBe('xml')
    })

    it('returns ini for .ini files', () => {
      expect(getLanguageFromFilename('settings.ini')).toBe('ini')
    })

    it('returns ini for .cfg files', () => {
      expect(getLanguageFromFilename('setup.cfg')).toBe('ini')
    })

    it('returns ini for .env files', () => {
      expect(getLanguageFromFilename('.env')).toBe('ini')
    })

    it('returns ini for .properties files', () => {
      expect(getLanguageFromFilename('app.properties')).toBe('ini')
    })

    it('returns protobuf for .proto files', () => {
      expect(getLanguageFromFilename('service.proto')).toBe('protobuf')
    })
  })

  describe('Markup / Documentation', () => {
    it('returns markdown for .md files', () => {
      expect(getLanguageFromFilename('README.md')).toBe('markdown')
    })

    it('returns markdown for .mdx files', () => {
      expect(getLanguageFromFilename('post.mdx')).toBe('markdown')
    })

    it('returns latex for .tex files', () => {
      expect(getLanguageFromFilename('paper.tex')).toBe('latex')
    })
  })

  describe('Systems languages', () => {
    it('returns python for .py files', () => {
      expect(getLanguageFromFilename('main.py')).toBe('python')
    })

    it('returns python for .pyi files', () => {
      expect(getLanguageFromFilename('stubs.pyi')).toBe('python')
    })

    it('returns go for .go files', () => {
      expect(getLanguageFromFilename('main.go')).toBe('go')
    })

    it('returns rust for .rs files', () => {
      expect(getLanguageFromFilename('lib.rs')).toBe('rust')
    })

    it('returns c for .c files', () => {
      expect(getLanguageFromFilename('main.c')).toBe('c')
    })

    it('returns c for .h files', () => {
      expect(getLanguageFromFilename('header.h')).toBe('c')
    })

    it('returns cpp for .cpp files', () => {
      expect(getLanguageFromFilename('engine.cpp')).toBe('cpp')
    })

    it('returns cpp for .hpp files', () => {
      expect(getLanguageFromFilename('engine.hpp')).toBe('cpp')
    })

    it('returns cpp for .cc files', () => {
      expect(getLanguageFromFilename('util.cc')).toBe('cpp')
    })

    it('returns cpp for .cxx files', () => {
      expect(getLanguageFromFilename('impl.cxx')).toBe('cpp')
    })

    it('returns java for .java files', () => {
      expect(getLanguageFromFilename('Main.java')).toBe('java')
    })

    it('returns csharp for .cs files', () => {
      expect(getLanguageFromFilename('Program.cs')).toBe('csharp')
    })

    it('returns swift for .swift files', () => {
      expect(getLanguageFromFilename('App.swift')).toBe('swift')
    })

    it('returns kotlin for .kt files', () => {
      expect(getLanguageFromFilename('Main.kt')).toBe('kotlin')
    })

    it('returns kotlin for .kts files', () => {
      expect(getLanguageFromFilename('build.gradle.kts')).toBe('kotlin')
    })

    it('returns scala for .scala files', () => {
      expect(getLanguageFromFilename('App.scala')).toBe('scala')
    })

    it('returns dart for .dart files', () => {
      expect(getLanguageFromFilename('main.dart')).toBe('dart')
    })
  })

  describe('Scripting languages', () => {
    it('returns ruby for .rb files', () => {
      expect(getLanguageFromFilename('server.rb')).toBe('ruby')
    })

    it('returns ruby for .gemspec files', () => {
      expect(getLanguageFromFilename('my_gem.gemspec')).toBe('ruby')
    })

    it('returns php for .php files', () => {
      expect(getLanguageFromFilename('index.php')).toBe('php')
    })

    it('returns perl for .pl files', () => {
      expect(getLanguageFromFilename('script.pl')).toBe('perl')
    })

    it('returns perl for .pm files', () => {
      expect(getLanguageFromFilename('Module.pm')).toBe('perl')
    })

    it('returns lua for .lua files', () => {
      expect(getLanguageFromFilename('config.lua')).toBe('lua')
    })

    it('returns r for .r files', () => {
      expect(getLanguageFromFilename('analysis.r')).toBe('r')
    })

    it('returns r for .R files (case insensitive)', () => {
      expect(getLanguageFromFilename('analysis.R')).toBe('r')
    })
  })

  describe('Functional languages', () => {
    it('returns elixir for .ex files', () => {
      expect(getLanguageFromFilename('server.ex')).toBe('elixir')
    })

    it('returns elixir for .exs files', () => {
      expect(getLanguageFromFilename('test_helper.exs')).toBe('elixir')
    })

    it('returns clojure for .clj files', () => {
      expect(getLanguageFromFilename('core.clj')).toBe('clojure')
    })

    it('returns clojure for .cljs files', () => {
      expect(getLanguageFromFilename('app.cljs')).toBe('clojure')
    })

    it('returns clojure for .cljc files', () => {
      expect(getLanguageFromFilename('shared.cljc')).toBe('clojure')
    })

    it('returns haskell for .hs files', () => {
      expect(getLanguageFromFilename('Main.hs')).toBe('haskell')
    })

    it('returns erlang for .erl files', () => {
      expect(getLanguageFromFilename('server.erl')).toBe('erlang')
    })
  })

  describe('Shell / DevOps', () => {
    it('returns bash for .sh files', () => {
      expect(getLanguageFromFilename('deploy.sh')).toBe('bash')
    })

    it('returns bash for .bash files', () => {
      expect(getLanguageFromFilename('profile.bash')).toBe('bash')
    })

    it('returns bash for .zsh files', () => {
      expect(getLanguageFromFilename('.zshrc.zsh')).toBe('bash')
    })

    it('returns powershell for .ps1 files', () => {
      expect(getLanguageFromFilename('setup.ps1')).toBe('powershell')
    })

    it('returns sql for .sql files', () => {
      expect(getLanguageFromFilename('migration.sql')).toBe('sql')
    })

    it('returns dockerfile for .dockerfile files', () => {
      expect(getLanguageFromFilename('app.dockerfile')).toBe('dockerfile')
    })

    it('returns hcl for .tf files', () => {
      expect(getLanguageFromFilename('main.tf')).toBe('hcl')
    })

    it('returns hcl for .hcl files', () => {
      expect(getLanguageFromFilename('config.hcl')).toBe('hcl')
    })

    it('returns hcl for .tfvars files', () => {
      expect(getLanguageFromFilename('vars.tfvars')).toBe('hcl')
    })

    it('returns groovy for .groovy files', () => {
      expect(getLanguageFromFilename('Jenkinsfile.groovy')).toBe('groovy')
    })

    it('returns groovy for .gradle files', () => {
      expect(getLanguageFromFilename('build.gradle')).toBe('groovy')
    })
  })

  describe('Special filenames', () => {
    it('returns dockerfile for Dockerfile', () => {
      expect(getLanguageFromFilename('Dockerfile')).toBe('dockerfile')
    })

    it('returns dockerfile for Dockerfile with path', () => {
      expect(getLanguageFromFilename('docker/Dockerfile')).toBe('dockerfile')
    })

    it('returns dockerfile for Dockerfile.dev', () => {
      expect(getLanguageFromFilename('Dockerfile.dev')).toBe('dockerfile')
    })

    it('returns makefile for Makefile', () => {
      expect(getLanguageFromFilename('Makefile')).toBe('makefile')
    })

    it('returns makefile for GNUmakefile', () => {
      expect(getLanguageFromFilename('GNUmakefile')).toBe('makefile')
    })

    it('returns yaml for .gitignore', () => {
      expect(getLanguageFromFilename('.gitignore')).toBe('yaml')
    })

    it('returns yaml for .dockerignore', () => {
      expect(getLanguageFromFilename('.dockerignore')).toBe('yaml')
    })

    it('returns yaml for .eslintignore', () => {
      expect(getLanguageFromFilename('.eslintignore')).toBe('yaml')
    })

    it('returns yaml for .prettierignore', () => {
      expect(getLanguageFromFilename('.prettierignore')).toBe('yaml')
    })
  })

  describe('Case insensitivity', () => {
    it('handles uppercase extensions', () => {
      expect(getLanguageFromFilename('README.MD')).toBe('markdown')
    })

    it('handles mixed case extensions', () => {
      expect(getLanguageFromFilename('app.Tsx')).toBe('typescript')
    })

    it('handles uppercase YAML', () => {
      expect(getLanguageFromFilename('config.YAML')).toBe('yaml')
    })
  })

  describe('Edge cases', () => {
    it('returns undefined for unknown extensions', () => {
      expect(getLanguageFromFilename('file.xyz')).toBeUndefined()
    })

    it('returns undefined for files with no extension and no special name', () => {
      expect(getLanguageFromFilename('LICENSE')).toBeUndefined()
    })

    it('handles deeply nested paths', () => {
      expect(getLanguageFromFilename('src/components/layout/TopBar.tsx')).toBe('typescript')
    })

    it('handles files with multiple dots', () => {
      expect(getLanguageFromFilename('app.config.ts')).toBe('typescript')
    })

    it('handles empty string', () => {
      expect(getLanguageFromFilename('')).toBeUndefined()
    })
  })
})
