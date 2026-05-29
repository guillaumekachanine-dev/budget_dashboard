export const AMBIANCE_BACKGROUND: Record<string, string> = {
  '🌃': 'linear-gradient(180deg, #010C1F 0%, #061B3A 28%, #0C1F54 58%, #11153F 82%, #0D0B2E 100%)',
  '🌅': 'linear-gradient(175deg, #1C0733 0%, #6B21A8 14%, #BE4E11 32%, #EA7316 46%, #F5A623 60%, #FADA6A 74%, #FEF3C7 100%)',
  '🌿': 'linear-gradient(180deg, #071A03 0%, #0F3308 18%, #1A5210 38%, #226B14 56%, #2F8A1C 72%, #64C832 87%, #A3E635 100%)',
  '🏙️': 'linear-gradient(185deg, #0A0118 0%, #160834 18%, #2B1060 36%, #6A1F8A 52%, #C0185A 68%, #E64A19 84%, #FF6E00 100%)',
  '🏰': 'linear-gradient(180deg, #7DD3FC 0%, #BAE6FD 35%, #FEF08A 75%, #FDE047 100%)',
  '🌉': 'linear-gradient(180deg, #7DD3FC 0%, #BAE6FD 35%, #FEF08A 75%, #FDE047 100%)',
}

const AMBIANCE_DEFAULT = 'linear-gradient(180deg, #010C1F 0%, #061B3A 28%, #0C1F54 58%, #11153F 82%, #0D0B2E 100%)'

export function tripAmbianceBackground(emoji: string | null | undefined): string {
  return AMBIANCE_BACKGROUND[(emoji ?? '').trim()] ?? AMBIANCE_DEFAULT
}

export function AmbianceBgScene({ emoji }: { emoji: string }) {
  const e = emoji.trim()
  const ambiance = e === '🌅' ? 'sunset' : e === '🌿' ? 'natural' : e === '🏙️' ? 'city_trip' : e === '🏰' || e === '🌉' ? 'eastern_europe' : 'city_lights'

  if (ambiance === 'city_lights') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Stars */}
        {([
          [6,18,1.3],[12,6,1.0],[20,22,1.6],[27,9,0.8],[35,18,1.4],[43,5,1.1],
          [50,20,0.9],[58,10,1.5],[65,4,1.2],[72,22,0.8],[79,12,1.6],[86,7,1.0],
          [91,19,1.3],[95,11,0.9],[97,4,1.1],
        ] as [number,number,number][]).map(([l,t,r],i) => (
          <div key={i} style={{
            position: 'absolute', left: `${l}%`, top: `${t}%`,
            width: r, height: r, borderRadius: '50%',
            background: 'rgba(255,255,255,0.88)',
            boxShadow: `0 0 ${r * 3}px rgba(180,210,255,0.8)`,
          }} />
        ))}
        {/* Neon cyan glow top-right */}
        <div style={{ position:'absolute', top:-16, right:30, width:80, height:80, borderRadius:'50%', background:'rgba(6,182,212,0.18)', filter:'blur(22px)' }} />
        {/* Neon magenta glow bottom-right */}
        <div style={{ position:'absolute', bottom:-10, right:8, width:60, height:60, borderRadius:'50%', background:'rgba(217,70,239,0.14)', filter:'blur(18px)' }} />
        {/* City skyline right half */}
        <svg viewBox="0 0 240 56" preserveAspectRatio="xMaxYMax meet"
          style={{ position:'absolute', bottom:0, right:0, width:'62%', height:'100%' }}>
          <rect x="0"   y="22" width="16" height="34" fill="#04091E"/>
          <rect x="2"   y="12" width="5"  height="10" fill="#04091E"/>
          <rect x="20"  y="32" width="13" height="24" fill="#050C26"/>
          <rect x="37"  y="14" width="11" height="42" fill="#030820"/>
          <rect x="38"  y="8"  width="3"  height="6"  fill="#030820"/>
          <rect x="52"  y="26" width="15" height="30" fill="#060E28"/>
          <rect x="71"  y="10" width="10" height="46" fill="#040A22"/>
          <rect x="72"  y="4"  width="3"  height="6"  fill="#040A22"/>
          <rect x="85"  y="30" width="13" height="26" fill="#050D26"/>
          <rect x="102" y="18" width="11" height="38" fill="#040C24"/>
          <rect x="117" y="8"  width="16" height="48" fill="#030920"/>
          <rect x="118" y="2"  width="4"  height="6"  fill="#030920"/>
          <rect x="137" y="24" width="12" height="32" fill="#060F28"/>
          <rect x="153" y="12" width="18" height="44" fill="#040A22"/>
          <rect x="175" y="28" width="16" height="28" fill="#050C24"/>
          <rect x="195" y="16" width="14" height="40" fill="#040B22"/>
          <rect x="213" y="6"  width="28" height="50" fill="#030820"/>
          {/* Neon windows */}
          <rect x="4"   y="26" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="39"  y="18" width="2" height="1.5" fill="#22D3EE" opacity="0.85"/>
          <rect x="73"  y="14" width="2" height="1.5" fill="#F0ABFC" opacity="0.9"/>
          <rect x="103" y="22" width="2" height="1.5" fill="#67E8F9" opacity="0.85"/>
          <rect x="119" y="12" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="154" y="18" width="2" height="1.5" fill="#E879F9" opacity="0.85"/>
          <rect x="215" y="12" width="2" height="1.5" fill="#22D3EE" opacity="0.9"/>
          <rect x="221" y="20" width="2" height="1.5" fill="#F0ABFC" opacity="0.8"/>
        </svg>
      </div>
    )
  }

  if (ambiance === 'sunset') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Sun orb */}
        <div style={{
          position: 'absolute', top: '8%', right: '16%',
          width: 44, height: 44, borderRadius: '50%',
          background: 'radial-gradient(circle, #FFFDE7 0%, #FFD54F 32%, #FF8F00 62%, transparent 100%)',
          boxShadow: '0 0 36px 14px rgba(255,175,0,0.32)',
        }} />
        {/* Light rays radial */}
        <div style={{ position:'absolute', top:0, right:0, width:'65%', height:'100%', background:'radial-gradient(ellipse at 75% 28%, rgba(255,214,0,0.22) 0%, transparent 68%)' }} />
        {/* Warm purple shadow left */}
        <div style={{ position:'absolute', top:-10, left:-10, width:70, height:70, borderRadius:'50%', background:'rgba(120,30,90,0.28)', filter:'blur(22px)' }} />
        {/* Ocean waves bottom */}
        <svg viewBox="0 0 400 56" preserveAspectRatio="none"
          style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'52%' }}>
          <path d="M0 26 Q60 16 120 24 Q180 32 240 18 Q300 6 360 20 Q390 26 400 18 L400 56 L0 56 Z" fill="rgba(251,191,36,0.48)"/>
          <path d="M0 36 Q80 24 160 34 Q240 42 320 28 Q380 16 400 32 L400 56 L0 56 Z" fill="rgba(234,115,22,0.38)"/>
          {/* Sun reflection */}
          <ellipse cx="290" cy="46" rx="16" ry="3.5" fill="rgba(255,245,130,0.55)"/>
        </svg>
        {/* Sand strip at very bottom */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:7, background:'rgba(253,224,138,0.55)' }} />
      </div>
    )
  }

  if (ambiance === 'city_trip') {
    return (
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        <style>{`
          @keyframes ct-row-sa { 0%,100%{opacity:.85} 43%,53%{opacity:.2} }
          @keyframes ct-row-sb { 0%,100%{opacity:.78} 21%,31%{opacity:.16} 69%,76%{opacity:.44} }
          @keyframes ct-row-sc { 0%,100%{opacity:.72} 55%,65%{opacity:.14} }
          @keyframes ct-row-car { from{transform:translateX(-80px)} to{transform:translateX(500px)} }
          @keyframes ct-row-ped { from{transform:translateX(100px)} to{transform:translateX(-60px)} }
        `}</style>

        {/* Atmosphere blobs */}
        <div style={{ position:'absolute', top:-22, left:-12, width:95, height:95, borderRadius:'50%', background:'rgba(107,31,138,0.38)', filter:'blur(26px)' }} />
        <div style={{ position:'absolute', top:-16, right:12, width:82, height:82, borderRadius:'50%', background:'rgba(194,24,91,0.3)', filter:'blur(22px)' }} />
        <div style={{ position:'absolute', bottom:-18, right:-10, width:88, height:88, borderRadius:'50%', background:'rgba(230,74,25,0.22)', filter:'blur(24px)' }} />

        <svg viewBox="0 0 400 56" preserveAspectRatio="none" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
          <defs>
            <radialGradient id="ct-row-vp" cx="50%" cy="0%" r="35%">
              <stop offset="0%" stopColor="#C2185B" stopOpacity="0.42"/>
              <stop offset="100%" stopColor="#C2185B" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* Building facades */}
          <rect x="0"   y="0" width="148" height="56" fill="#130828"/>
          <rect x="0"   y="0" width="8"   height="56" fill="#0D0420"/>
          <rect x="128" y="0" width="20"  height="44" fill="#180A35"/>
          <rect x="252" y="0" width="148" height="56" fill="#130828"/>
          <rect x="392" y="0" width="8"   height="56" fill="#0D0420"/>
          <rect x="252" y="0" width="20"  height="44" fill="#180A35"/>

          {/* Street */}
          <polygon points="148,56 252,56 224,0 176,0" fill="#0A0320"/>
          <polygon points="148,56 252,56 224,0 176,0" fill="rgba(194,24,91,0.1)"/>
          <rect x="0" y="0" width="400" height="56" fill="url(#ct-row-vp)"/>

          {/* Road center dashes */}
          <rect x="199.5" y="42" width="2"   height="7"   fill="rgba(255,140,180,0.32)"/>
          <rect x="200"   y="30" width="1.6" height="5.5" fill="rgba(255,140,180,0.22)"/>
          <rect x="200"   y="20" width="1.3" height="4"   fill="rgba(255,140,180,0.14)"/>
          <rect x="200"   y="12" width="1"   height="3"   fill="rgba(255,140,180,0.08)"/>

          {/* Sidewalks */}
          <polygon points="0,42 148,56 0,56"   fill="#160434" opacity="0.82"/>
          <polygon points="400,42 252,56 400,56" fill="#160434" opacity="0.82"/>

          {/* Left windows */}
          {([
            [9,3],[21,3],[33,3],[45,3],[57,3],[69,3],[81,3],[93,3],[105,3],[117,3],[129,3],[141,3],
            [9,13],[33,13],[57,13],[81,13],[105,13],[129,13],
            [9,23],[45,23],[69,23],[93,23],[129,23],
            [21,33],[57,33],[93,33],[117,33],
            [9,43],[45,43],[81,43],[117,43],
          ] as [number,number][]).map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="8" height="5"
              fill={['#E91E63','#7C3AED','#22D3EE','#F59E0B','#C2185B'][i%5]}
              opacity={0.18+((i*17)%10)*0.038}/>
          ))}

          {/* Right windows */}
          {([
            [258,3],[270,3],[282,3],[294,3],[306,3],[318,3],[330,3],[342,3],[354,3],[366,3],[378,3],[390,3],
            [258,13],[282,13],[306,13],[330,13],[354,13],[378,13],
            [270,23],[306,23],[342,23],[378,23],
            [258,33],[294,33],[342,33],[378,33],
            [270,43],[318,43],[366,43],[390,43],
          ] as [number,number][]).map(([x,y],i) => (
            <rect key={i} x={x} y={y} width="8" height="5"
              fill={['#C2185B','#6D28D9','#06B6D4','#EA580C','#E91E63'][i%5]}
              opacity={0.18+((i*19)%10)*0.038}/>
          ))}

          {/* Neon signs — left */}
          <rect x="5"   y="43" width="46" height="9"  rx="2.5" fill="#E91E63" opacity="0.85" style={{animation:'ct-row-sa 3.2s ease-in-out infinite'}}/>
          <rect x="6"   y="44" width="44" height="7"  rx="1.5" fill="none" stroke="rgba(255,192,210,0.5)" strokeWidth="0.7"/>
          <rect x="60"  y="39" width="36" height="8"  rx="2"   fill="#7C3AED" opacity="0.78" style={{animation:'ct-row-sb 4.5s ease-in-out infinite 1s'}}/>
          <rect x="106" y="42" width="26" height="8"  rx="2"   fill="#FF6F00" opacity="0.70" style={{animation:'ct-row-sc 5.2s ease-in-out infinite 0.5s'}}/>

          {/* Neon signs — right */}
          <rect x="349" y="43" width="46" height="9"  rx="2.5" fill="#C2185B" opacity="0.85" style={{animation:'ct-row-sb 3.8s ease-in-out infinite 0.7s'}}/>
          <rect x="350" y="44" width="44" height="7"  rx="1.5" fill="none" stroke="rgba(255,160,200,0.5)" strokeWidth="0.7"/>
          <rect x="304" y="39" width="36" height="8"  rx="2"   fill="#6D28D9" opacity="0.78" style={{animation:'ct-row-sa 4.3s ease-in-out infinite 1.8s'}}/>
          <rect x="268" y="42" width="26" height="8"  rx="2"   fill="#EA580C" opacity="0.70" style={{animation:'ct-row-sc 5.6s ease-in-out infinite 0.3s'}}/>

          {/* Street lamps */}
          <rect x="139"   y="20" width="2.5" height="36" fill="#251060" opacity="0.9"/>
          <rect x="132"   y="20" width="9"   height="2.5" fill="#251060" opacity="0.85"/>
          <circle cx="132" cy="21" r="6"   fill="rgba(253,224,71,0.14)"/>
          <circle cx="132" cy="21" r="2.5" fill="rgba(253,224,71,0.88)"/>

          <rect x="258.5" y="20" width="2.5" height="36" fill="#251060" opacity="0.9"/>
          <rect x="259"   y="20" width="9"   height="2.5" fill="#251060" opacity="0.85"/>
          <circle cx="268" cy="21" r="6"   fill="rgba(253,224,71,0.14)"/>
          <circle cx="268" cy="21" r="2.5" fill="rgba(253,224,71,0.88)"/>
        </svg>

        {/* Animated car headlights */}
        <div style={{ position:'absolute', bottom:16, left:0, pointerEvents:'none', animation:'ct-row-car 5s linear infinite', width:55, height:2, borderRadius:4, background:'linear-gradient(90deg,transparent,rgba(255,220,80,0.85),rgba(255,255,180,0.6),transparent)' }} />
        {/* Pedestrian */}
        <div style={{ position:'absolute', bottom:4, left:80, pointerEvents:'none', animation:'ct-row-ped 8s linear infinite 1s', width:4, height:14, borderRadius:'2px 2px 0 0', background:'rgba(0,0,0,0.68)' }} />
      </div>
    )
  }

  if (ambiance === 'eastern_europe') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Sun */}
        <div style={{
          position: 'absolute', top: '6%', left: '15%',
          width: 36, height: 36, borderRadius: '50%',
          background: 'radial-gradient(circle, #FFFFFF 0%, #FEF08A 70%, transparent 100%)',
          boxShadow: '0 0 20px 6px rgba(254,240,138,0.5)',
        }} />
        
        {/* Clouds */}
        <div style={{ position: 'absolute', top: '15%', right: '10%', width: 50, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.4)', filter: 'blur(1px)' }} />
        <div style={{ position: 'absolute', top: '8%', right: '35%', width: 70, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.3)', filter: 'blur(1px)' }} />

        <svg viewBox="0 0 400 56" preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '80%' }}>
          {/* Distant Hills / Buda Castle silhouette */}
          <path d="M-10 40 Q40 22 100 28 Q160 34 220 20 Q280 14 340 26 Q380 32 410 26 L410 56 L-10 56 Z" fill="rgba(14, 116, 144, 0.28)"/>
          
          {/* Spire, domes and old town silhouettes */}
          {/* Parliament / castle dome */}
          <path d="M 85 40 L 95 24 Q 100 12 105 24 L 115 40 Z" fill="rgba(8, 145, 178, 0.45)" />
          <rect x="99" y="10" width="2" height="15" fill="rgba(8, 145, 178, 0.45)" />
          
          {/* Tall spires (Gothic style) */}
          <polygon points="180,40 185,15 190,40" fill="rgba(6, 182, 212, 0.35)" />
          <polygon points="192,40 195,8 198,40" fill="rgba(6, 182, 212, 0.35)" />
          
          <polygon points="310,40 315,10 320,40" fill="rgba(8, 145, 178, 0.4)" />
          <polygon points="322,40 326,16 330,40" fill="rgba(8, 145, 178, 0.4)" />

          {/* Danube / Vltava River */}
          <rect x="-10" y="38" width="420" height="20" fill="#38BDF8" opacity="0.6"/>
          <path d="M-10 44 Q80 38 170 45 Q260 52 350 42 Q385 38 410 44 L410 56 L-10 56 Z" fill="#0284C7" opacity="0.4"/>

          {/* Bridge arches spanning across the river */}
          {/* Bridge road */}
          <rect x="-10" y="42" width="420" height="4" fill="rgba(254, 240, 138, 0.9)" />
          {/* Arches */}
          <path d="M 20 46 Q 35 34 50 46" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="2.5" />
          <path d="M 100 46 Q 115 34 130 46" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="2.5" />
          <path d="M 180 46 Q 195 34 210 46" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="2.5" />
          <path d="M 260 46 Q 275 34 290 46" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="2.5" />
          <path d="M 340 46 Q 355 34 370 46" fill="none" stroke="rgba(254, 240, 138, 0.9)" strokeWidth="2.5" />
        </svg>
      </div>
    )
  }

  // natural
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Sun top-right */}
      <div style={{
        position: 'absolute', top: -12, right: -6,
        width: 58, height: 58, borderRadius: '50%',
        background: 'radial-gradient(circle, #FEF08A 0%, #FDE047 38%, #FACC15 62%, transparent 100%)',
        boxShadow: '0 0 32px 12px rgba(253,224,71,0.28)',
      }} />
      <div style={{ position:'absolute', top:0, right:0, width:'45%', height:'100%', background:'radial-gradient(ellipse at 90% 12%, rgba(253,224,71,0.2) 0%, transparent 62%)' }} />
      {/* Hills + flora */}
      <svg viewBox="0 0 400 56" preserveAspectRatio="none"
        style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'72%' }}>
        {/* Back hills */}
        <path d="M-10 36 Q55 8 130 28 Q205 48 275 14 Q340 -4 410 22 L410 56 L-10 56 Z" fill="rgba(22,101,52,0.62)"/>
        {/* Front hills */}
        <path d="M-10 44 Q70 20 155 38 Q240 54 318 26 Q378 10 410 34 L410 56 L-10 56 Z" fill="rgba(20,83,45,0.78)"/>
        {/* Ground */}
        <rect x="-10" y="50" width="420" height="8" fill="rgba(15,68,36,0.88)"/>
        {/* Yellow flowers */}
        {([32,72,114,158,200,244,290,336,374] as number[]).map((x,i) => (
          <circle key={i} cx={x} cy={50+(i%3)} r="2" fill="#FDE047" opacity="0.92"/>
        ))}
        {/* Green accent dots */}
        {([52,96,140,184,226,270,314,358] as number[]).map((x,i) => (
          <circle key={i} cx={x} cy={49+(i%2)*2} r="1.4" fill="#A3E635" opacity="0.78"/>
        ))}
        {/* Tree trunks + canopy */}
        <rect x="62"  y="32" width="3" height="14" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="63.5" cy="28" rx="8" ry="9"  fill="rgba(22,163,74,0.72)"/>
        <rect x="192" y="30" width="3" height="16" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="193.5" cy="26" rx="9" ry="10" fill="rgba(21,128,61,0.68)"/>
        <rect x="332" y="28" width="3" height="18" fill="rgba(10,40,20,0.82)"/>
        <ellipse cx="333.5" cy="24" rx="9" ry="10" fill="rgba(22,163,74,0.68)"/>
      </svg>
    </div>
  )
}
