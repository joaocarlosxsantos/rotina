import React from "react";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { PET_CATALOG, PET_KINDS } from "../src/lib/pets";
import { PetSprite, type Mood } from "../src/app/pet-sprites";

const moods: readonly [Mood, string][] = [["sad", "Triste"], ["ok", "De boa"], ["happy", "Feliz"]];
async function main() {
const css = await readFile(resolve("src/app/globals.css"), "utf8");
const motion = css.match(/\/\* PET_MOTION_START[\s\S]*?\/\* PET_MOTION_END \*\//)?.[0];
if (!motion) throw new Error("CSS dos pets não encontrado.");

const page = renderToStaticMarkup(<html lang="pt-BR"><head>
  <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Companheiros — Rotina Pet · 32×32</title>
  <style>{`
    *{box-sizing:border-box}body{margin:0;background:#f8f7f2;color:#203e32;font:16px/1.5 Georgia,serif;padding:32px}
    h1{font-size:2.5rem;line-height:1.1;margin:0 0 12px}h2{margin:0 0 4px}p{max-width:70ch}label,figcaption,small{font-family:Arial,sans-serif}
    label{display:inline-block;padding:12px;cursor:pointer}input{width:20px;height:20px;vertical-align:middle}input:focus-visible{outline:3px solid #ad4c30;outline-offset:4px}
    main{display:grid;gap:32px;margin-top:24px}article{border-top:1px solid #c5cbbf;padding-top:24px}article>p{margin:4px 0 16px}
    .boards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.board{padding:20px;border:1px solid #c5cbbf;border-radius:14px}
    .light{background:#fffefb}.dark{background:#141c17;color:#eef3ea;border-color:#385348}.moods{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    figure{display:flex;flex-direction:column;align-items:center;justify-content:end;gap:12px;margin:24px 0 0;min-width:0}figcaption{font-size:14px}
    .pair{display:flex;align-items:end;justify-content:center;gap:12px;flex-wrap:wrap}svg{flex-shrink:0;image-rendering:pixelated}
    .sizes{font:12px Arial,sans-serif;margin-bottom:8px}.sample{display:flex;flex-direction:column;align-items:center}
    #animate:not(:checked)~main *{animation:none!important}
    @media(prefers-reduced-motion:no-preference){#animate:checked~main .pet-body,#animate:checked~main .pet-eyes{animation-iteration-count:infinite}}
    @media(max-width:1100px){.boards{grid-template-columns:1fr}}@media(max-width:600px){body{padding:20px}.moods{grid-template-columns:1fr}.pair{flex-wrap:nowrap}}
    @media print{label,#animate{display:none}main *{animation:none!important}article{break-inside:avoid}}
    ${motion}
  `}</style>
</head><body>
  <h1>Seis jeitos de fazer companhia.</h1>
  <p>Matrizes de 32×32 pixels, exibidas sem suavização em 64 e 128 px. Os três humores lado a lado, no papel claro e no fundo noturno da marca.</p>
  <input id="animate" type="checkbox" /><label htmlFor="animate">Animar prévias (desmarque para pausar)</label>
  <main>{PET_KINDS.map(kind => <article key={kind} id={kind}><h2>{PET_CATALOG[kind].name}</h2><p>{PET_CATALOG[kind].description}</p>
    <div className="boards">{["light", "dark"].map(theme => <section key={theme} className={`board ${theme}`} aria-label={`${PET_CATALOG[kind].name} em fundo ${theme === "light" ? "claro" : "escuro"}`}>
      <small>Fundo {theme === "light" ? "claro" : "escuro"}</small><div className="moods">{moods.map(([mood, label]) => <figure key={mood}><div className="pair">{[64, 128].map(size => <div className="sample" key={size}><span className="sizes">{size} px</span><PetSprite kind={kind} mood={mood} size={size} label={`${PET_CATALOG[kind].name} ${label.toLowerCase()}`} /></div>)}</div><figcaption>{label}</figcaption></figure>)}</div>
    </section>)}</div></article>)}</main>
  <p>Prévia gerada do catálogo por <code>npm run pets:preview</code>. Sem JavaScript, fontes remotas ou CDN. O movimento respeita a preferência por movimento reduzido.</p>
</body></html>);
await mkdir(resolve("docs"), { recursive: true });
await writeFile(resolve("docs/pets-preview.html"), `<!doctype html>\n${page}\n`, "utf8");
console.log("Prévia gerada: docs/pets-preview.html (6 pets × 3 humores × 2 tamanhos × 2 fundos).");
}
main().catch(() => { console.error("Não foi possível gerar a prévia dos pets."); process.exitCode = 1; });
