# Aura — Video Generation & Production Script
**Project:** Aura Virtual Try-On Studio  
**Format:** 16:9 Landscape (also adaptable to 9:16 Vertical for Reels / Shorts / TikTok)  
**Target Duration:** 36 Seconds  
**Audio Style:** Intimate ambient keys swelling into an uplifting, confident modern beat  
**Voiceover Tone:** Warm, conversational, articulate, confident (e.g., ElevenLabs "Rachel" or "Adam")  

---

## 📋 Shot-by-Shot Production Table

| Scene & Time | Visual Direction | Camera Motion | Voiceover (Spoken Word) | On-Screen Text / UI | Audio / SFX |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scene 1**<br>`0:00 - 0:09`<br>*(9 sec)* | Disappointed young woman sitting in living room surrounded by open delivery boxes labeled "RETURN", holding an ill-fitting sweater. | Slow push-in toward her frustrated expression and return shipping labels. | *"Online fashion was supposed to be effortless. But 40% of clothes bought online get returned because they simply don't fit or look on you like they did on the model."* | **ACT I: THE CRISIS**<br>• 40% Online Return Rate<br>• Size & Drape Mismatch | Muffled ambient room tone, soft tape-unsealing and cardboard rustle SFX, melancholic ambient chord (E minor). |
| **Scene 2**<br>`0:09 - 0:18`<br>*(9 sec)* | Close-up in dim cozy room; woman browsing clothing apps on smartphone in bed. Hesitant finger hovering over "Buy Now". | Slow tracking shot across screen glare and thoughtful eyes. | *"Endless late-night scrolling, full shopping carts, and hesitation at checkout. We pause because we can't answer the simplest question: 'How will this look on ME?'"* | **ACT II: THE HESITATION**<br>• Checkout Abandonment<br>• "Will this look good on me?" | Gentle phone screen tap SFX, subtle bass drone swelling in frequency, transition chime. |
| **Scene 3**<br>`0:18 - 0:27`<br>*(9 sec)* | Modern studio desk; user accesses **Aura AI**. Drops portrait photo and a green blazer + gold earrings. AI instantly drapes and contours them with realistic shadows. | Dynamic zoom toward the laptop screen, showcasing live AI generation. | *"Enter Aura. Upload your photo and any piece of clothing or jewelry. Advanced computer vision contours fabrics and positions accessories with realistic lighting in seconds."* | **ACT III: THE SOLUTION**<br>• Clothes V4 + Jewelry VTO<br>• Ephemeral In-Memory Privacy | Bright digital whoosh SFX, uplifting electronic synth chords (G Maj → D Maj), subtle shutter click. |
| **Scene 4**<br>`0:27 - 0:36`<br>*(9 sec)* | Radiant woman standing in front of a full-length mirror in sunlit room, wearing the fitted blazer and earrings, smiling with pure confidence. | Gentle upward tilt from the fitted jacket to her glowing, confident smile. | *"No guesswork. No return piles. Just the confidence of knowing your look matches you before it ever ships. Aura: Virtual fitting, real confidence."* | **ACT IV: REAL CONFIDENCE**<br>• Zero Return Fatigue<br>• **aura.** Try-On Studio | Full upbeat beat drop, warm acoustic snare, triumphant finish chord, gentle fade out. |

---

## 🤖 Direct Prompts for AI Video & Audio Engines

If you are using generative AI tools to produce or enhance this video, use the following prompts:

### 1. ElevenLabs Voiceover Script Prompt
* **Voice Model:** Rachel (Calm, engaging, friendly) or Adam (Direct, deep, trustworthy)
* **Stability:** 0.65 | **Clarity / Similarity:** 0.85 | **Style Exaggeration:** 0.15
* **Input Text:**
```text
Online fashion was supposed to be effortless. But forty percent of clothes bought online get returned because they simply don't look on you like they did on the model.

Endless late-night scrolling, full carts, and hesitation at checkout. We pause because we cannot answer the simplest question: How will this look on me?

Enter Aura. Upload your photo and any clothing or jewelry. Advanced computer vision drapes the fabric and positions accessories with realistic lighting in seconds.

No guesswork. No return piles. Just the confidence of knowing your look matches you before it ever ships. Aura: Virtual fitting, real confidence.
```

---

### 2. AI Video Generation Prompts (Runway Gen-3 Alpha / Sora / Kling / Luma Dream Machine)

#### **Scene 1 (The Problem - 0:00 to 0:09)**
```prompt
Cinematic 16:9 4k shot of a frustrated young woman sitting on hardwood living room floor surrounded by open cardboard delivery boxes and plastic return parcels, holding an ill-fitting oversized beige knitted sweater with disappointment. Slow camera zoom-in toward her face and return stickers on boxes. Warm, moody interior lighting, photorealistic cinematic film grain.
```

#### **Scene 2 (The Hesitation - 0:09 to 0:18)**
```prompt
Cinematic medium close-up of a thoughtful young woman in cozy bedroom lighting at night, browsing a fashion clothing app on her glowing smartphone, light from the screen reflecting softly in her eyes, showing hesitation and contemplation before clicking purchase. Slow subtle camera orbit, high quality, soft bokeh background.
```

#### **Scene 3 (The Aura Solution - 0:18 to 0:27)**
```prompt
Cinematic camera glide toward a modern laptop screen on a wooden studio desk displaying the Aura AI Virtual Try-On web interface. On the screen, a portrait photo seamlessly transforms with a stylish tailored emerald green blazer and matching jewelry in real-time, sleek dark UI with glowing accents, realistic studio lighting, 4k.
```

#### **Scene 4 (The Outcome - 0:27 to 0:36)**
```prompt
Cinematic wide shot of a confident young woman standing in front of a full-length mirror in a sunlit modern apartment, wearing a tailored green blazer and elegant earrings, smiling warmly and admiring her reflection. Natural golden hour sunlight, smooth upward camera tilt, vibrant lifestyle fashion photography.
```

---

### 3. Suno / Udio AI Background Music Prompt
* **Genre:** Modern Indie-Pop / Ambient Electronic
* **Tags:** `warm synth pads, ambient piano, rising inspiring beat, subtle electronic percussion, optimistic, tech commercial, 110 bpm`
* **Prompt Structure:**
  - `[0:00 - 0:15]` Soft introspective piano and warm ambient pad, subtle low drone.
  - `[0:16 - 0:26]` Melodic synth arpeggio enters, rising build-up, bright acoustic chime.
  - `[0:27 - 0:36]` Uplifting, punchy indie-electronic beat, vibrant percussion, triumphant finish with smooth fade.

---

## 💻 Standalone Automated Video Generator CLI

You can also run the built-in video generator directly in your browser or export it to a `.webm` file:
- **Live Interactive Player:** Open `http://localhost:3939/story.html`
- **One-Click Export:** Click the **"📥 Export Video (.webm)"** button to compile canvas animations, audio synthesizer tracks, and narration directly into a saved video.
