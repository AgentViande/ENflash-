import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return null;
  }
}

function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log('\n⚡ ENflash - Automatisation de Release & Publication\n');

  // 1. Déterminer le type de version
  let bumpType = process.argv[2]?.toLowerCase();
  if (!bumpType || !['patch', 'minor', 'major'].includes(bumpType)) {
    console.log('Quel type d’incrément de version souhaitez-vous publier ?');
    console.log('1) patch (corrections, petits ajustements, ex: 1.0.0 -> 1.0.1)');
    console.log('2) minor (nouvelles fonctionnalités, ex: 1.0.0 -> 1.1.0)');
    console.log('3) major (refonte majeure, ex: 1.0.0 -> 2.0.0)');
    const answer = await promptUser('Votre choix (patch / minor / major) [défaut: patch] : ');
    bumpType = answer === '2' || answer === 'minor' ? 'minor' : answer === '3' || answer === 'major' ? 'major' : 'patch';
  }

  // 2. Lire le package.json actuel
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = pkg.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  let newVersion = '';
  if (bumpType === 'major') newVersion = `${major + 1}.0.0`;
  else if (bumpType === 'minor') newVersion = `${major}.${minor + 1}.0`;
  else newVersion = `${major}.${minor}.${patch + 1}`;

  console.log(`\n📌 Passage de la version v${currentVersion} à la version v${newVersion} (${bumpType})`);

  // 3. Récupérer les derniers commits depuis le dernier tag
  const lastTag = runCommand('git describe --tags --abbrev=0');
  const gitLogCmd = lastTag
    ? `git log ${lastTag}..HEAD --oneline`
    : `git log -n 15 --oneline`;

  const rawCommits = runCommand(gitLogCmd) || '';
  const commitLines = rawCommits.split('\n').filter(Boolean);

  const newFeatures = [];
  const improvements = [];
  const fixes = [];
  const otherChanges = [];

  for (const line of commitLines) {
    const text = line.replace(/^[a-f0-9]+\s+/, '').trim();
    const lower = text.toLowerCase();
    if (lower.startsWith('feat') || lower.includes('ajout') || lower.includes('nouveau')) {
      newFeatures.push(text);
    } else if (lower.startsWith('fix') || lower.includes('corr') || lower.includes('bug')) {
      fixes.push(text);
    } else if (lower.startsWith('perf') || lower.startsWith('refactor') || lower.includes('amelior') || lower.includes('style')) {
      improvements.push(text);
    } else {
      otherChanges.push(text);
    }
  }

  // Si pas de commit catégorisé, fournir un contenu propre
  if (newFeatures.length === 0 && improvements.length === 0 && fixes.length === 0) {
    newFeatures.push('Déploiement de la version initiale d’ENflash avec toutes les fonctionnalités clés');
    improvements.push('Optimisation du stockage hors ligne et répétition espacée Leitner');
  }

  // 4. Générer le patch note en français
  const today = new Date().toISOString().split('T')[0];
  let patchNote = `## [v${newVersion}] - ${today}\n\n`;

  if (newFeatures.length > 0) {
    patchNote += `### 🚀 Nouveautés\n`;
    newFeatures.forEach((c) => (patchNote += `- ${c}\n`));
    patchNote += `\n`;
  }

  if (improvements.length > 0) {
    patchNote += `### ✨ Améliorations\n`;
    improvements.forEach((c) => (patchNote += `- ${c}\n`));
    patchNote += `\n`;
  }

  if (fixes.length > 0) {
    patchNote += `### 🐛 Corrections\n`;
    fixes.forEach((c) => (patchNote += `- ${c}\n`));
    patchNote += `\n`;
  }

  console.log('\n📝 Patch notes généré :\n');
  console.log(patchNote);

  // 5. Mettre à jour package.json
  pkg.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log('✔ package.json mis à jour');

  // 6. Mettre à jour CHANGELOG.md
  let existingChangelog = '';
  if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf-8');
  } else {
    existingChangelog = `# Journal des modifications (CHANGELOG) - ENflash\n\n`;
  }

  const updatedChangelog = existingChangelog.includes('# Journal des modifications')
    ? existingChangelog.replace(
        /# Journal des modifications[^\n]*\n\n/,
        `# Journal des modifications (CHANGELOG) - ENflash\n\n${patchNote}`
      )
    : `# Journal des modifications (CHANGELOG) - ENflash\n\n${patchNote}${existingChangelog}`;

  fs.writeFileSync(changelogPath, updatedChangelog, 'utf-8');
  console.log('✔ CHANGELOG.md mis à jour');

  // 7. Git commit et tag
  const tagName = `v${newVersion}`;
  try {
    execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' });
    execSync(`git commit -m "chore(release): ${tagName}"`, { stdio: 'inherit' });
    execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, { stdio: 'inherit' });
    console.log(`✔ Tag Git ${tagName} créé localement avec succès.`);
  } catch (err) {
    console.error('Erreur lors du commit/tag Git:', err.message);
    return;
  }

  console.log(`\n🚀 Pour publier sur GitHub et déclencher la compilation Windows NSIS :`);
  console.log(`git push origin main && git push origin ${tagName}\n`);
}

main().catch(console.error);
