'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'story-assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist', 'video');

const scenes = [
  {
    id: 1,
    title: 'The Return Dilemma',
    image: 'scene1.jpg',
    duration: 9,
    voiceover: "Online fashion was supposed to be effortless. But 40% of clothes bought online get returned because they simply don't fit or look on you like they did on the model."
  },
  {
    id: 2,
    title: 'Checkout Hesitation',
    image: 'scene2.jpg',
    duration: 9,
    voiceover: "Endless late-night scrolling, full shopping carts, and hesitation at checkout. We pause because we can't answer the simplest question: 'How will this look on ME?'"
  },
  {
    id: 3,
    title: 'Aura AI Try-On Solution',
    image: 'scene3.jpg',
    duration: 9,
    voiceover: "Enter Aura. Upload your photo and any piece of clothing or jewelry. Advanced computer vision contours fabrics and positions accessories with realistic lighting in seconds."
  },
  {
    id: 4,
    title: 'Confident Fit Outcome',
    image: 'scene4.jpg',
    duration: 9,
    voiceover: "No guesswork. No return piles. Just the confidence of knowing your look matches you before it ever ships. Aura: Virtual fitting, real confidence."
  }
];

function checkAssets() {
  console.log('\n[Aura Video Generator] Checking scene assets...');
  let allExist = true;
  for (const scene of scenes) {
    const fullPath = path.join(ASSETS_DIR, scene.image);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      console.log(`  ✓ Scene ${scene.id}: ${scene.image} (${Math.round(stats.size / 1024)} KB)`);
    } else {
      console.error(`  ✗ Missing: ${scene.image} in ${ASSETS_DIR}`);
      allExist = false;
    }
  }
  return allExist;
}

function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function printSummary() {
  const totalSeconds = scenes.reduce((sum, s) => sum + s.duration, 0);
  console.log('\n======================================================');
  console.log('       AURA VIDEO GENERATION SPECIFICATION');
  console.log('======================================================');
  console.log(`Total Duration: ${totalSeconds} seconds (${scenes.length} scenes)`);
  console.log(`Aspect Ratio:   16:9 (1920x1080)`);
  console.log(`Interactive:    http://localhost:3939/story.html`);
  console.log('------------------------------------------------------');
  
  scenes.forEach(s => {
    console.log(`\nScene ${s.id} [${s.duration}s]: ${s.title}`);
    console.log(`  Asset: ${s.image}`);
    console.log(`  Voice: "${s.voiceover}"`);
  });
  console.log('\n======================================================');
}

function main() {
  const assetsReady = checkAssets();
  printSummary();

  const hasFfmpeg = checkFfmpeg();
  if (hasFfmpeg) {
    console.log('\n[FFmpeg detected]');
    console.log('To render high-fps MP4 with ffmpeg, run:');
    console.log('  ffmpeg -f concat -safe 0 -i scripts/video-manifest.txt -vf "fps=30,scale=1920:1080" -pix_fmt yuv420p output.mp4\n');
  } else {
    console.log('\n[Direct Browser Export Available]');
    console.log('The easiest way to generate the video file is via the Aura Live Story Player:');
    console.log('  1. Open http://localhost:3939/story.html');
    console.log('  2. Click the "📥 Export Video (.webm)" button.');
    console.log('  3. The video will render with dynamic Ken Burns motion and export directly.\n');
  }
}

main();
