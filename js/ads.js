// Ad layer. Every ad in the game goes through ON.Ads, so a real SDK
// (AdMob through Capacitor, or a web ad network) only has to provide ON.nativeAdProvider.
//
// Placements:
//   rewarded:      hint_refill, shuffle_refill, time_revive
//   interstitial:  stage_end (only between stages, frequency-capped)
(() => {
  'use strict';
  const ON = (window.ON = window.ON || {});

  const POLICY = {
    firstInterstitialAfterStages: 3, // never in a player's first 3 finished stages
    stagesBetweenInterstitials: 2,   // at most every 2nd stage end
    minSecondsBetweenAds: 90,        // and never within 90s of any other ad (incl. rewarded)
    mockInterstitialOnWeb: false,    // the web build has no ad network yet: skip, don't fake it
  };

  const state = { lastAdAt: 0, stagesSince: 0 };

  // Mock provider: a stand-in full-screen ad so the reward flow works and can be tested.
  function mockAd({ kind, placement }) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ad-mock';
      const secs = 3;
      el.innerHTML = `
        <div class="ad-box">
          <div class="ad-tag">IKLAN CONTOH</div>
          <div class="ad-title">${kind === 'rewarded' ? 'Iklan berhadiah' : 'Iklan'}</div>
          <div class="ad-sub">${placement}</div>
          <div class="ad-ring"><span>${secs}</span></div>
          <p class="ad-note">Nanti di sini tampil iklan asli. Sekarang hadiahnya tetap kamu dapat.</p>
          <button class="btn primary ad-close" disabled>Tunggu...</button>
        </div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      const btn = el.querySelector('.ad-close');
      const num = el.querySelector('.ad-ring span');
      let left = secs;
      const iv = setInterval(() => {
        left--;
        num.textContent = Math.max(0, left);
        if (left > 0) return;
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = kind === 'rewarded' ? 'Ambil hadiah' : 'Tutup';
      }, 1000);
      btn.addEventListener('click', () => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
        resolve(true);
      });
    });
  }

  const isNative = () => !!ON.nativeAdProvider;
  const provider = () => ON.nativeAdProvider || {
    showRewarded: (placement) => mockAd({ kind: 'rewarded', placement }),
    showInterstitial: (placement) => mockAd({ kind: 'interstitial', placement }),
  };

  async function run(kind, placement) {
    ON.track && ON.track('ad_request', { kind, placement });
    ON.Sfx && ON.Sfx.duck(true);
    let ok = false;
    try {
      ok = kind === 'rewarded' ? await provider().showRewarded(placement) : await provider().showInterstitial(placement);
    } catch { ok = false; }
    ON.Sfx && ON.Sfx.duck(false);
    // a full-screen ad (real SDKs especially) can leave the audio context paused
    if (ON.Sfx && ON.Sfx.ac && ON.Sfx.ac.state !== 'running') ON.Sfx.ac.resume().catch(() => {});
    state.lastAdAt = Date.now();
    ON.track && ON.track(ok ? 'ad_complete' : 'ad_failed', { kind, placement });
    return ok;
  }

  ON.Ads = {
    POLICY,
    // Promise<boolean>: true when the reward should be granted
    rewarded(placement) { return run('rewarded', placement); },

    // call after every finished stage (cleared or failed)
    async stageEnded(totalStages) {
      state.stagesSince++;
      if (!isNative() && !POLICY.mockInterstitialOnWeb) return false;
      if ((ON.profile && ON.profile.noAds) || totalStages < POLICY.firstInterstitialAfterStages) return false;
      if (state.stagesSince < POLICY.stagesBetweenInterstitials) return false;
      if (Date.now() - state.lastAdAt < POLICY.minSecondsBetweenAds * 1000) return false;
      state.stagesSince = 0;
      return run('interstitial', 'stage_end');
    },
  };
})();
