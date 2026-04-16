const urls = [
    'https://lh3.googleusercontent.com/d/1yIyAjjFb4OWV8_3mWylH0kYGYp7zwqc5',
    'https://lh3.googleusercontent.com/d/1d9Z05-mmJYodqSVcxw5n_wdWrWfsE5fu',
    'https://lh3.googleusercontent.com/d/1ds9ibA6URL5wEaLeZ6y0qFbm-13a4h2R'
];

function cleanGoogleDriveUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
        const match = url.match(/[-\w]{25,}/);
        if (match) {
            return `https://drive.google.com/uc?export=view&id=${match[0]}`;
        }
    }
    return url;
}

urls.forEach(u => console.log(u, '=>', cleanGoogleDriveUrl(u)));
