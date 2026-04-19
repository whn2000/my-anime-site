(function() {
    window.showToast = function(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '30px';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%, 20px)';
        toast.style.padding = '12px 24px';
        toast.style.background = type === 'error' ? '#ff4757' : 'rgba(251, 146, 158, 0.95)';
        toast.style.color = '#fff';
        toast.style.borderRadius = '50px';
        toast.style.boxShadow = '0 10px 30px rgba(251, 146, 158, 0.4)';
        toast.style.zIndex = '99999';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        toast.style.fontWeight = '600';
        toast.style.fontSize = '14px';
        toast.style.backdropFilter = 'blur(10px)';
        toast.innerHTML = (type === 'error' ? '❌ ' : '🌸 ') + msg;
        
        document.body.appendChild(toast);
        
        // Trigger reflow
        void toast.offsetWidth;
        
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    };

    // Override native alert globally
    window.alert = function(msg) {
        window.showToast(msg);
    };
})();
