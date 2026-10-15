// Inlines the dist-preview build into one page for the preview host. The host
// adds its own <!doctype>, <html>, <head> and <body>, so this writes only the
// title, the styles, the root div and the script.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = 'dist-preview/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`Expected one JS file, found ${js.length}`);

const script = readFileSync(`${dir}/${js[0]}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const styles = css.map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');

mkdirSync('preview', { recursive: true });
writeFileSync(
  'preview/waste-utilities-preview.html',
  `<title>Waste and Utilities Dashboard</title>
<style>${styles}</style>
<div id="root"></div>
<script type="module">${script}</script>
`,
);
console.log('Wrote preview/waste-utilities-preview.html');
