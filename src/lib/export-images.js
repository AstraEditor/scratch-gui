import JSZip from '@turbowarp/jszip';

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} uint8Array 
 * @returns {string} base64 string
 */
const uint8ArrayToBase64 = (uint8Array) => {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return window.btoa(binary);
};

/**
 * Calculate the maximum texture scale for SVG
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {number} [maxTextureDimension=4096] - Maximum texture dimension, default 4096
 * @returns {number} Maximum scale factor (power of 2)
 */
const calculateMaxTextureScale = (width, height, maxTextureDimension = 4096) => {
    const maxDimension = Math.ceil(Math.max(width, height));
    
    if (maxDimension <= 0) {
        return 1;
    }
    
    let testScale = 2;
    let maxTextureScale = 1;
    
    while (maxDimension * testScale <= maxTextureDimension) {
        maxTextureScale = testScale;
        testScale *= 2;
    }
    
    return maxTextureScale;
};

/**
 * Convert SVG data to PNG using canvas
 * @param {Uint8Array} svgData - SVG data as Uint8Array
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<string>} PNG data as base64 string
 */
const svgToPng = async (svgData, width, height) => {
    return new Promise((resolve, reject) => {
        const svgString = new TextDecoder().decode(svgData);
        const img = new Image();
        
        // Use the same method as SVGSkin.js to load SVG
        const svgUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
        
        img.onload = () => {
            // Calculate optimal scale for better quality
            const scale = calculateMaxTextureScale(width, height);
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;
            
            const canvas = document.createElement('canvas');
            canvas.width = scaledWidth;
            canvas.height = scaledHeight;
            const ctx = canvas.getContext('2d');
            
            // Enable high quality scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
            
            const pngData = canvas.toDataURL('image/png').split(',')[1];
            resolve(pngData);
        };
        
        img.onerror = (error) => {
            console.error('Failed to load SVG:', error);
            reject(error);
        };
        
        img.src = svgUrl;
    });
};

/**
 * Export all costumes from the project as PNG files in a ZIP archive
 * @param {VM} vm - The Scratch VM instance
 * @param {boolean} convertSvgToPng - Whether to convert SVG to PNG
 */
export const exportAllImagesAsPNG = async (vm, convertSvgToPng = false) => {
    const zip = new JSZip();
    const targets = vm.runtime.targets;
    const imageCount = { count: 0 };
    const convertedCount = { count: 0 }; // Track converted PNGs
    const imageInfoList = [];
    
    console.log('Exporting images. Targets found:', targets.length);
    
    for (const target of targets) {
        // Skip the stage
        if (target.isStage) {
            console.log('Skipping stage target');
            continue;
        }
        
        console.log('Processing target:', target.sprite.name, 'has sprite:', !!target.sprite);
        
        if (!target.sprite || !target.sprite.costumes) {
            console.log('Target has no sprite or costumes:', target.sprite);
            continue;
        }
        
        console.log('Target has', target.sprite.costumes.length, 'costumes');
        
        for (const costume of target.sprite.costumes) {
            try {
                console.log('Processing costume:', costume.name);
                
                // Get the asset from costume
                const asset = costume.broken ? costume.broken.asset : costume.asset;
                if (!asset) {
                    console.log('Costume has no asset:', costume.name);
                    continue;
                }
                if (!asset.data) {
                    console.log('Costume asset has no data:', costume.name);
                    continue;
                }
                
                const spriteName = target.sprite.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                let fileName;
                let base64Data;
                let scale = 1;
                
                if (convertSvgToPng && asset.dataFormat === 'svg') {
                    // Convert SVG to PNG
                    console.log('Converting SVG to PNG:', costume.name, 'size:', costume.size);
                    scale = calculateMaxTextureScale(costume.size[0], costume.size[1]);
                    const pngData = await svgToPng(asset.data, costume.size[0], costume.size[1]);
                    fileName = `${spriteName}_costume_${costume.name}.png`;
                    base64Data = pngData;
                    console.log('Converted successfully:', fileName, 'scale:', scale);
                    
                    // Use the costume's assetId as the MD5 (this matches what's saved in sb3 files)
                    const md5Hash = costume.assetId;
                    console.log('Using costume assetId as MD5:', md5Hash);
                    
                    // Increment converted count
                    convertedCount.count++;
                    
                    // Add image info to list (only for converted PNGs)
                    imageInfoList.push({
                        fileName: fileName,
                        md5: md5Hash,
                        scale: scale
                    });
                } else {
                    // Keep original format
                    console.log('Keeping original format:', costume.name, 'format:', asset.dataFormat);
                    base64Data = uint8ArrayToBase64(asset.data);
                    fileName = `${spriteName}_costume_${costume.name}.${asset.dataFormat}`;
                    
                    // Use the costume's assetId as the MD5
                    const md5Hash = costume.assetId;
                    
                    // Add image info to list (for all images)
                    imageInfoList.push({
                        fileName: fileName,
                        md5: md5Hash,
                        scale: 1
                    });
                }
                
                zip.file(fileName, base64Data, { base64: true });
                imageCount.count++;
            } catch (error) {
                console.warn('Failed to export costume:', costume.name, error);
            }
        }
    }
    
    console.log('Total images exported:', imageCount.count);
    console.log('Converted to PNG:', convertedCount.count);
    console.log('Image info list:', imageInfoList);
    
    if (imageCount.count === 0) {
        alert('No costumes found in the project. Check console for details.');
        return;
    }
    
    // Add JSON file with image information for all images
    const metadata = {
        exportDate: new Date().toISOString(),
        totalImages: imageCount.count,
        convertedToPng: convertedCount.count,
        images: imageInfoList
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    console.log('metadata.json added successfully');
    
    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'project_costumes.zip';
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Failed to generate ZIP file:', error);
        alert('Failed to export costumes.');
    }
};