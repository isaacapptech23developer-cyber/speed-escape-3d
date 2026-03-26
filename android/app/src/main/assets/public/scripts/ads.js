export const AdMob = {
    init() {
        console.log("Ads: Initialized");
    },
    showBanner() {
        console.log("Ads: showBanner");
    },
    hideBanner() {
        console.log("Ads: hideBanner");
    },
    async showInterstitialAd() {
        return new Promise((resolve) => {
            let adShown = false;
            if (typeof window.showInterstitialAd === 'function') {
                window.showInterstitialAd();
                adShown = true;
            } else if (typeof showInterstitialAd === 'function') {
                showInterstitialAd();
                adShown = true;
            } else if (typeof AppCreator24 !== 'undefined' && AppCreator24.showInterstitialAd) {
                AppCreator24.showInterstitialAd();
                adShown = true;
            }
            
            if (adShown) {
                const focusHandler = () => {
                    window.removeEventListener('focus', focusHandler);
                    setTimeout(() => resolve(true), 500);
                };
                window.addEventListener('focus', focusHandler);
                setTimeout(() => {
                    window.removeEventListener('focus', focusHandler);
                    resolve(true);
                }, 10000);
            } else {
                resolve(false);
            }
        });
    },
    async showRewardedAd() {
        return new Promise((resolve) => {
            let adShown = false;
            
            // AppCreator24 callbacks
            window.onRewardedAdCompleted = () => {
                resolve(true);
            };
            window.onRewardedAdFailed = () => {
                alert("Ad not available, try again");
                resolve(false);
            };
            
            if (typeof window.showRewardedAd === 'function') {
                window.showRewardedAd();
                adShown = true;
            } else if (typeof showRewardedAd === 'function') {
                showRewardedAd();
                adShown = true;
            } else if (typeof AppCreator24 !== 'undefined' && AppCreator24.showRewardedAd) {
                AppCreator24.showRewardedAd();
                adShown = true;
            }
            
            if (!adShown) {
                // Fallback for development/testing if no ad SDK is present
                console.log("Ad SDK not found. Simulating ad watch for 2 seconds...");
                setTimeout(() => {
                    resolve(true);
                }, 2000);
            }
        });
    }
};
