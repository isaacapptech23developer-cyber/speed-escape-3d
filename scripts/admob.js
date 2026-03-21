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
        console.log("Ads: showInterstitialAd");
        if (typeof window.showInterstitialAd === 'function') {
            window.showInterstitialAd();
        } else if (typeof showInterstitialAd === 'function') {
            showInterstitialAd();
        }
        return true;
    },
    async showRewardedAd() {
        console.log("Ads: showRewardedAd");
        if (typeof window.showRewardedAd === 'function') {
            window.showRewardedAd();
        } else if (typeof showRewardedAd === 'function') {
            showRewardedAd();
        }
        return true;
    }
};
