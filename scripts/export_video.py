import os
import sys
import math
import wave
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, 'public', 'story-assets')
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')
ROOT_MP4 = os.path.join(BASE_DIR, 'Aura-Virtual-TryOn-Story.mp4')
PUBLIC_MP4 = os.path.join(PUBLIC_DIR, 'Aura-Virtual-TryOn-Story.mp4')
ROOT_WEBM = os.path.join(BASE_DIR, 'Aura-Virtual-TryOn-Story.webm')
PUBLIC_WEBM = os.path.join(PUBLIC_DIR, 'Aura-Virtual-TryOn-Story.webm')
AUDIO_WAV = os.path.join(BASE_DIR, 'scripts', 'temp_soundtrack.wav')

WIDTH = 1920
HEIGHT = 1080
FPS = 30
SCENE_DURATION = 9  # seconds per scene
TOTAL_DURATION = 36 # 4 scenes * 9s = 36s

scenes = [
    {
        'id': 1,
        'image': os.path.join(ASSETS_DIR, 'scene1.jpg'),
        'act': 'ACT I: THE CRISIS',
        'title': 'The E-Commerce Fit Dilemma',
        'sub': "Online shopping was supposed to be effortless. But nearly 40% of apparel bought online ends up returned because it simply doesn't look or fit on you like it did on the model.",
        'zoom_start': 1.0,
        'zoom_end': 1.12,
    },
    {
        'id': 2,
        'image': os.path.join(ASSETS_DIR, 'scene2.jpg'),
        'act': 'ACT II: THE HESITATION',
        'title': 'Checkout Hesitation & Doubt',
        'sub': "Endless late-night scrolling, full carts, and abandoned orders. Shoppers pause because they cannot answer the single most important question: 'How will this look on ME?'",
        'zoom_start': 1.14,
        'zoom_end': 1.02,
    },
    {
        'id': 3,
        'image': os.path.join(ASSETS_DIR, 'scene3.jpg'),
        'act': 'ACT III: THE SOLUTION',
        'title': 'Aura AI — Instant Fitting Studio',
        'sub': "Enter Aura. Upload your photo and any piece of clothing or jewelry. Advanced computer vision drapes fabrics and positions accessories with realistic lighting in seconds.",
        'zoom_start': 1.02,
        'zoom_end': 1.15,
    },
    {
        'id': 4,
        'image': os.path.join(ASSETS_DIR, 'scene4.jpg'),
        'act': 'ACT IV: REAL CONFIDENCE',
        'title': 'Wear What You Love. Zero Remorse.',
        'sub': "No guesswork. No return piles. Just the confidence of knowing your look matches you before it ever ships. Aura: Virtual fitting, real confidence.",
        'zoom_start': 1.12,
        'zoom_end': 1.0,
    }
]

def generate_soundtrack():
    print('[1/4] Synthesizing ambient cinematic soundtrack...')
    sample_rate = 44100
    total_samples = int(sample_rate * TOTAL_DURATION)
    
    # Chord progressions (Em, C, G, D) with harmonics
    chords = [
        [164.81, 196.00, 246.94, 329.63], # Em
        [130.81, 196.00, 261.63, 329.63], # C
        [196.00, 246.94, 293.66, 392.00], # G
        [146.83, 220.00, 293.66, 369.99], # D
    ]
    
    audio_data = np.zeros(total_samples, dtype=np.float32)
    t = np.linspace(0, TOTAL_DURATION, total_samples, endpoint=False)
    
    for i, chord in enumerate(chords):
        c_start = i * 9.0
        c_end = (i + 1) * 9.0
        mask = (t >= c_start) & (t < c_end)
        t_chord = t[mask] - c_start
        
        # Envelope: soft attack and decay
        env = np.sin(np.pi * (t_chord / 9.0)) ** 0.5
        
        chord_wave = np.zeros_like(t_chord)
        for freq in chord:
            # Fundamental + soft octave overtone
            chord_wave += 0.08 * np.sin(2 * np.pi * freq * t_chord)
            chord_wave += 0.03 * np.sin(2 * np.pi * (freq * 2) * t_chord)
            chord_wave += 0.015 * np.sin(2 * np.pi * (freq * 3) * t_chord)
            
        audio_data[mask] += chord_wave * env

    # Add gentle ambient tape hiss & warmth
    audio_data += 0.002 * np.random.normal(0, 1, total_samples)
    
    # Normalize
    max_val = np.max(np.abs(audio_data))
    if max_val > 0:
        audio_data = audio_data / max_val * 0.75
        
    int_audio = (audio_data * 32767).astype(np.int16)
    
    with wave.open(AUDIO_WAV, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_audio.tobytes())
    print(f'  Soundtrack generated: {AUDIO_WAV}')

def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        test_line = ' '.join(current_line + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        w = bbox[2] - bbox[0]
        if w <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]
    if current_line:
        lines.append(' '.join(current_line))
    return lines

def get_font(size, bold=False):
    # Try Windows system fonts
    font_names = ['segoeui.ttf', 'arial.ttf', 'calibri.ttf']
    if bold:
        font_names = ['segoeuib.ttf', 'arialbd.ttf', 'calibrib.ttf']
    for name in font_names:
        p = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', name)
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def render_frame(t, base_images, font_brand, font_meta, font_act, font_title, font_sub):
    scene_idx = min(int(t // SCENE_DURATION), len(scenes) - 1)
    scene = scenes[scene_idx]
    scene_time = t - (scene_idx * SCENE_DURATION)
    progress = max(0.0, min(1.0, scene_time / SCENE_DURATION))
    
    base_img = base_images[scene['id']]
    scale = scene['zoom_start'] + (scene['zoom_end'] - scene['zoom_start']) * progress
    
    # Zoom around center
    bw, bh = base_img.size
    crop_w = int(bw / scale)
    crop_h = int(bh / scale)
    cx, cy = bw // 2, bh // 2
    left = max(0, cx - crop_w // 2)
    top = max(0, cy - crop_h // 2)
    right = min(bw, left + crop_w)
    bottom = min(bh, top + crop_h)
    
    cropped = base_img.crop((left, top, right, bottom)).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    
    # Crossfade near start/end of scene (0.6s)
    fade_dur = 0.6
    alpha = 1.0
    if scene_time < fade_dur:
        alpha = scene_time / fade_dur
    elif SCENE_DURATION - scene_time < fade_dur:
        alpha = (SCENE_DURATION - scene_time) / fade_dur
    
    if alpha < 1.0:
        black = Image.new('RGB', (WIDTH, HEIGHT), (5, 7, 5))
        cropped = Image.blend(black, cropped, alpha)
        
    draw = ImageDraw.Draw(cropped, 'RGBA')
    
    # Top vignette gradient
    for y in range(180):
        opacity = int(220 * (1.0 - y / 180.0))
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, opacity))
        
    # Bottom vignette gradient
    for y in range(HEIGHT - 320, HEIGHT):
        dy = y - (HEIGHT - 320)
        opacity = int(240 * (dy / 320.0))
        draw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, opacity))
        
    # Top bar elements
    draw.text((60, 45), 'aura.', font=font_brand, fill=(45, 226, 135, 255))
    draw.text((155, 52), '•   VIRTUAL TRY-ON STORY', font=font_meta, fill=(180, 192, 184, 230))
    
    sec = int(t % 60)
    m = int(t // 60)
    time_str = f'{m}:{sec:02d} / 0:36'
    draw.text((WIDTH - 180, 52), time_str, font=font_meta, fill=(229, 185, 90, 240))
    
    # Lower third graphics
    draw.text((60, HEIGHT - 235), scene['act'], font=font_act, fill=(45, 226, 135, 255))
    draw.text((60, HEIGHT - 195), scene['title'], font=font_title, fill=(255, 255, 255, 255))
    
    sub_lines = wrap_text(draw, scene['sub'], font_sub, WIDTH - 120)
    sy = HEIGHT - 130
    for line in sub_lines:
        draw.text((60, sy), line, font=font_sub, fill=(225, 232, 227, 245))
        sy += 34
        
    # Bottom progress bar
    progress_w = int(WIDTH * (t / TOTAL_DURATION))
    draw.rectangle([(0, HEIGHT - 6), (progress_w, HEIGHT)], fill=(45, 226, 135, 255))
    
    return np.array(cropped)

def main():
    print('[Aura Video Export Engine]')
    print(f'Total Duration: {TOTAL_DURATION}s | Resolution: {WIDTH}x{HEIGHT} @ {FPS}fps')
    
    generate_soundtrack()
    
    print('[2/4] Preloading scene images...')
    base_images = {}
    for s in scenes:
        im = Image.open(s['image']).convert('RGB')
        base_images[s['id']] = im
        print(f'  Loaded scene {s["id"]}: {s["image"]} ({im.size[0]}x{im.size[1]})')
        
    font_brand = get_font(34, bold=True)
    font_meta = get_font(20, bold=False)
    font_act = get_font(18, bold=True)
    font_title = get_font(36, bold=True)
    font_sub = get_font(22, bold=False)
    
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    total_frames = int(TOTAL_DURATION * FPS)
    
    print(f'[3/4] Encoding high-definition MP4 with H.264 & AAC ({total_frames} frames)...')
    
    # Export MP4 via FFmpeg pipe
    import subprocess
    cmd_mp4 = [
        ffmpeg_exe,
        '-y',
        '-f', 'rawvideo',
        '-vcodec', 'rawvideo',
        '-s', f'{WIDTH}x{HEIGHT}',
        '-pix_fmt', 'rgb24',
        '-r', str(FPS),
        '-i', '-',
        '-i', AUDIO_WAV,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        ROOT_MP4
    ]
    
    proc = subprocess.Popen(cmd_mp4, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    for frame_idx in range(total_frames):
        t = frame_idx / FPS
        frame_data = render_frame(t, base_images, font_brand, font_meta, font_act, font_title, font_sub)
        proc.stdin.write(frame_data.tobytes())
        if frame_idx % 90 == 0:
            pct = int((frame_idx / total_frames) * 100)
            sys.stdout.write(f'\r  Rendering frames: {pct}% ({frame_idx}/{total_frames})')
            sys.stdout.flush()
            
    proc.stdin.close()
    proc.wait()
    print('\r  Rendering frames: 100% complete!            ')
    
    # Copy MP4 immediately to public/ directory
    import shutil
    shutil.copyfile(ROOT_MP4, PUBLIC_MP4)
    print(f'[4/4] Master MP4 saved to {ROOT_MP4} and {PUBLIC_MP4}')
    
    # Fast WebM generation (realtime speed)
    print('  Creating WebM copy...')
    cmd_webm = [
        ffmpeg_exe,
        '-y',
        '-i', ROOT_MP4,
        '-c:v', 'libvpx',
        '-speed', '8',
        '-b:v', '2500k',
        '-c:a', 'libopus',
        '-b:a', '128k',
        ROOT_WEBM
    ]
    subprocess.run(cmd_webm, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(ROOT_WEBM):
        shutil.copyfile(ROOT_WEBM, PUBLIC_WEBM)
    
    # Copy both to public/ directory
    import shutil
    shutil.copyfile(ROOT_MP4, PUBLIC_MP4)
    shutil.copyfile(ROOT_WEBM, PUBLIC_WEBM)
    
    # Cleanup temp wav
    if os.path.exists(AUDIO_WAV):
        os.remove(AUDIO_WAV)
        
    mp4_size_mb = os.path.getsize(ROOT_MP4) / (1024 * 1024)
    webm_size_mb = os.path.getsize(ROOT_WEBM) / (1024 * 1024)
    
    print('\n=============================================================')
    print('          AURA STORY VIDEO EXPORT SUCCESSFUL!                ')
    print('=============================================================')
    print(f'✓ Master MP4 Video:  {ROOT_MP4} ({mp4_size_mb:.2f} MB)')
    print(f'✓ WebM Video:        {ROOT_WEBM} ({webm_size_mb:.2f} MB)')
    print(f'✓ Public Web URL:    http://localhost:3939/Aura-Virtual-TryOn-Story.mp4')
    print(f'✓ Public WebM URL:   http://localhost:3939/Aura-Virtual-TryOn-Story.webm')
    print('=============================================================\n')

if __name__ == '__main__':
    main()
