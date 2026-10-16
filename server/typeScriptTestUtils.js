import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrls = new Map();
async function compileModule(url) {
  if (moduleUrls.has(url.href)) return moduleUrls.get(url.href);
  const compiled = (async () => {
    const source = await readFile(url, 'utf8');
    let { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const imports = [...outputText.matchAll(/\bfrom\s+(['"])(\.{1,2}\/[^'"]+)\1/g)];
    for (const [, quote, specifier] of imports) {
      const dependency = new URL(specifier.endsWith('.ts') ? specifier : `${specifier}.ts`, url);
      const dependencyUrl = await compileModule(dependency);
      outputText = outputText.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(dependencyUrl));
    }
    return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  })();
  moduleUrls.set(url.href, compiled);
  return compiled;
}

// Browser-independent TS modules have acyclic local imports. Transpile their
// real code for tests while retaining the app's Node 20 minimum.
export async function loadTypeScript(relativePath) {
  return import(await compileModule(new URL(relativePath, import.meta.url)));
}
