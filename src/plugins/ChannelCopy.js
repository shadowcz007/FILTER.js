/**
*
* Channel Copy Plugin
* @package FILTER.js
*
**/
!function(FILTER){

    @@USE_STRICT@@
    
    var notSupportClamp=FILTER._notSupportClamp, Min=Math.min, Floor=Math.floor,
        R=FILTER.CHANNEL.RED, G=FILTER.CHANNEL.GREEN, B=FILTER.CHANNEL.BLUE, A=FILTER.CHANNEL.ALPHA;
    
    // a plugin to copy a channel of an image to a channel of another image
    FILTER.ChannelCopyFilter = FILTER.Create({
        name: "ChannelCopyFilter"
        
        // parameters
        ,_srcImg: null
        ,srcImg: null
        ,centerX: 0
        ,centerY: 0
        ,srcChannel: 0
        ,dstChannel: 0
        
        // constructor
        ,init: function( srcImg, srcChannel, dstChannel, centerX, centerY ) {
            this._srcImg = null;
            this.srcImg = null;
            this.srcChannel = srcChannel || R;
            this.dstChannel = dstChannel || R;
            this.centerX = centerX || 0;
            this.centerY = centerY || 0;
            if ( srcImg ) this.setSrc( srcImg );
        }
        
        // support worker serialize/unserialize interface
        ,path: FILTER.getPath( )
        
        ,serialize: function( ) {
            var self = this;
            return {
                filter: self.name
                
                ,params: {
                    _srcImg: self._srcImg
                    ,centerX: self.centerX
                    ,centerY: self.centerY
                    ,srcChannel: self.srcChannel
                    ,dstChannel: self.dstChannel
                }
            };
        }
        
        ,unserialize: function( json ) {
            var self = this, params;
            if ( json && self.name === json.filter )
            {
                params = json.params;
                
                self._srcImg = params._srcImg;
                self.centerX = params.centerX;
                self.centerY = params.centerY;
                self.srcChannel = params.srcChannel;
                self.dstChannel = params.dstChannel;
            }
            return self;
        }
        
        ,setSrc: function( srcImg ) {
            if ( srcImg )
            {
                this.srcImg = srcImg;
                this._srcImg = { data: srcImg.getData( ), width: srcImg.width, height: srcImg.height };
            }
            return this;
        }
        
        // this is the filter actual apply method routine
        ,apply: function(im, w, h/*, image*/) {
            // im is a copy of the image data as an image array
            // w is image width, h is image height
            // image is the original image instance reference, generally not needed
            // for this filter, no need to clone the image data, operate in-place
            
            if ( !this._srcImg ) return im;
            
            var src = this._srcImg.data,
                i, l = im.length, l2 = src.length, 
                w2 = this._srcImg.width, 
                h2 = this._srcImg.height,
                sC = this.srcChannel, tC = this.dstChannel,
                x, x2, y, y2, off, xc, yc, 
                wm = Min(w,w2), hm = Min(h, h2),  
                cX = this.centerX||0, cY = this.centerY||0, 
                cX2 = (w2>>1), cY2 = (h2>>1)
            ;
            
            
            // make center relative
            cX = Floor(cX*(w-1)) - cX2;
            cY = Floor(cY*(h-1)) - cY2;
            
            i=0; x=0; y=0;
            for (i=0; i<l; i+=4, x++)
            {
                if (x>=w) { x=0; y++; }
                
                xc = x - cX; yc = y - cY;
                if (xc>=0 && xc<wm && yc>=0 && yc<hm)
                {
                    // copy channel
                    off = (xc + yc*w2)<<2;
                    im[i + tC] = src[off + sC];
                }
            }
            
            // return the new image data
            return im;
        }
    });
    
}(FILTER);