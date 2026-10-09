const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('frontend/src', function(err, results) {
  if (err) throw err;
  let fixedFiles = 0;
  results.forEach(file => {
    let buf = fs.readFileSync(file);
    let content = buf.toString('utf8');
    let hasBom = false;
    let missingNewline = false;
    let mixedLineEndings = false;
    let report = [];

    // Check BOM
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      hasBom = true; report.push('UTF-8 BOM');
    } else if (buf[0] === 0xFF && buf[1] === 0xFE) {
      hasBom = true; report.push('UTF-16 LE BOM');
      content = buf.toString('utf16le');
    } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
      hasBom = true; report.push('UTF-16 BE BOM');
      // No native utf16be in node, but unlikely from powershell on windows
    }

    // Check missing final newline
    if (content.length > 0 && !content.endsWith('\n')) {
      missingNewline = true; report.push('Missing final newline');
    }

    // Replace CRLF to LF to normalize (or check mixed)
    let hasCRLF = content.includes('\r\n');
    let hasLF = content.includes('\n') && !content.replace(/\r\n/g, '').includes('\n'); 
    // wait, if it has \n not preceded by \r, and also has \r\n, it's mixed
    let numCRLF = (content.match(/\r\n/g) || []).length;
    let numLF = (content.match(/[^\r]\n/g) || []).length;
    if (content.startsWith('\n')) numLF++;

    if (numCRLF > 0 && numLF > 0) {
      mixedLineEndings = true; report.push(`Mixed line endings (${numCRLF} CRLF, ${numLF} LF)`);
    }

    if (report.length > 0) {
      console.log(`${path.relative(process.cwd(), file)}: ${report.join(', ')}`);
      // Fix it!
      content = content.replace(/\r\n/g, '\n'); // normalize to LF
      if (!content.endsWith('\n')) content += '\n';
      fs.writeFileSync(file, content, 'utf8'); // writes without BOM
      fixedFiles++;
    }
  });
  console.log(`Checked ${results.length} files. Fixed ${fixedFiles} files.`);
});
