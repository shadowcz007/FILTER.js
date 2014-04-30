/**
*
* Statistical Filter(s)
*
* Applies statistical filtering/processing to target image
*
* @package FILTER.js
*
**/
!function(FILTER, undef){
    
    @@USE_STRICT@@
    
    // used for internal purposes
    var IMG=FILTER.ImArray, A32I=FILTER.Array32I,
        Min=Math.min, Max=Math.max, Filters;
        
    //
    //
    //  Statistical Filter
    var StatisticalFilter = FILTER.StatisticalFilter = FILTER.Class( FILTER.Filter, {
        name: "StatisticalFilter"
        
        ,constructor: function( ) {
            this._dim = 0;
            this._indices = null;
            this._filterName = null;
            this._filter = null;
        }
        
        ,_dim: 0
        ,_indices: null
        ,_filter: null
        ,_filterName: null
        
        ,dispose: function( ) {
            var self = this;
            
            self.disposeWorker( );
            
            self._dim = null;
            self._indices = null;
            self._filter = null;
            self._filterName = null;
            
            return self;
        }
        
        ,serialize: function( ) {
            var self = this;
            return {
                filter: self.name
                
                ,params: {
                    _filterName: self._filterName
                    ,_dim: self._dim
                    ,_indices: self._indices
                }
            };
        }
        
        ,unserialize: function( json ) {
            var self = this, params;
            if ( json && self.name === json.filter )
            {
                params = json.params;
                
                self._dim = params._dim;
                self._indices = params._indices;
                self._filterName = params._filterName;
                if ( self._filterName && Filters[ self._filterName ] )
                    self._filter = Filters[ self._filterName ].bind( self );
            }
            return self;
        }
        
        ,median: function( d ) { 
            // allow only odd dimensions for median
            d = ( d === undef ) ? 3 : ((d%2) ? d : d+1);
            return this.set( d, "median" );
        }
        
        ,minimum: function( d ) { 
            d = ( d === undef ) ? 3 : ((d%2) ? d : d+1);
            return this.set( d, "minimum" );
        }
        
        ,maximum: function( d ) { 
            d = ( d === undef ) ? 3 : ((d%2) ? d : d+1);
            return this.set( d, "maximum" );
        }
        
        ,set: function( d, filt ) {
            this._filterName = filt; 
            this._filter = Filters[ filt ].bind( this ); 
            this._dim = d; 
            // pre-compute indices, 
            // reduce redundant computations inside the main convolution loop (faster)
            var Indices=[], k, x, y,
                matArea=d*d, matRadius=d, matHalfSide=(matRadius>>1);
            x=0; y=0; k=0;
            while (k<matArea)
            { 
                Indices.push(x-matHalfSide); 
                Indices.push(y-matHalfSide);
                k++; x++; if (x>=matRadius) { x=0; y++; }
            }
            this._indices = new A32I(Indices);
            
            return this;
        }
        
        ,reset: function( ) {
            this._filterName = null; 
            this._filter = null; 
            this._dim = 0; 
            this._indices = null;
            return this;
        }
        
        // used for internal purposes
        ,_apply: function(im, w, h) {
            if ( !this._isOn || !this._dim )  return im;
            return this._filter( im, w, h );
        }
        
        ,apply: function( image ) {
            if ( this._isOn && this._dim )
            {
                var im = image.getSelectedData( );
                if ( this._worker )
                {
                    this
                        .bind( 'apply', function( data ) { 
                            this.unbind( 'apply' );
                            if ( data && data.im )
                                image.setSelectedData( data.im );
                        })
                        // send filter params to worker
                        .send( 'params', this.serialize( ) )
                        // process request
                        .send( 'apply', {im: im} )
                    ;
                }
                else
                {
                    image.setSelectedData( this._filter( im[0], im[1], im[2], image ) );
                }
            }
            return image;
        }
    });
    // aliiases
    StatisticalFilter.prototype.erode = StatisticalFilter.prototype.minimum;
    StatisticalFilter.prototype.dilate = StatisticalFilter.prototype.maximum;
    
    
    //
    //
    // private methods
    Filters = {
        "median": function( im, w, h ) {
            var 
                matRadius=this._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
                imageIndices=new A32I(this._indices),
                imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
                i, j, j2, x, ty, xOff, yOff, srcOff, 
                rM, gM, bM, r, g, b,
                medianR, medianG, medianB, len, len2,
                isOdd, matArea2=matArea<<1, bx=w-1, by=imArea-w
            ;
            
            rM = []; //new Array(matArea);
            gM = []; //new Array(matArea);
            bM = []; //new Array(matArea);
            
            // pre-compute indices, 
            // reduce redundant computations inside the main convolution loop (faster)
            for (j=0; j<matArea2; j+=2)
            { 
                // translate to image dimensions
                // the y coordinate
                imageIndices[j+1]*=w;
            }
            
            i=0; x=0; ty=0; 
            while (i<imLen)
            {
                // calculate the weighed sum of the source image pixels that
                // fall under the convolution matrix
                rM.length=0; gM.length=0; bM.length=0; 
                j=0; //j2=0;
                while (j < matArea2)
                {
                    xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                    if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                    {
                        srcOff=(xOff + yOff)<<2;
                        r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2]; 
                        rM.push(r); gM.push(g); bM.push(b);
                    }
                    j+=2; //j2+=1;
                }
                
                // sort them, this is SLOW, alternative implementation needed
                rM.sort(); gM.sort(); bM.sort();
                len=rM.length; len2=len>>1;
                medianR=(len%2) ? rM[len2+1] : ~~(0.5*(rM[len2] + rM[len2+1]));
                len=gM.length; len2=len>>1;
                medianG=(len%2) ? gM[len2+1] : ~~(0.5*(gM[len2] + gM[len2+1]));
                len=bM.length; len2=len>>1;
                medianB=(len%2) ? bM[len2+1] : ~~(0.5*(bM[len2] + bM[len2+1]));
                
                // output
                dst[i] = medianR;  dst[i+1] = medianG;   dst[i+2] = medianB;  
                dst[i+3] = im[i+3];
                
                // update image coordinates
                i+=4; x++; if (x>=w) { x=0; ty+=w; }
            }
            return dst;
        }
        
        ,"maximum": function( im, w, h ) {
            var 
                matRadius=this._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
                imageIndices=new A32I(this._indices),
                imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
                i, j, x, ty, xOff, yOff, srcOff, r, g, b, rM, gM, bM,
                matArea2=matArea<<1, bx=w-1, by=imArea-w
            ;
            
            // pre-compute indices, 
            // reduce redundant computations inside the main convolution loop (faster)
            for (j=0; j<matArea2; j+=2)
            { 
                // translate to image dimensions
                // the y coordinate
                imageIndices[j+1]*=w;
            }
            
            i=0; x=0; ty=0;
            while (i<imLen)
            {
                // calculate the weighed sum of the source image pixels that
                // fall under the convolution matrix
                rM=0; gM=0; bM=0; 
                j=0;
                while (j < matArea2)
                {
                    xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                    if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                    {
                        srcOff=(xOff + yOff)<<2;
                        r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2];
                        if (r>rM) rM=r; if (g>gM) gM=g; if (b>bM) bM=b;
                    }
                    j+=2;
                }
                
                // output
                dst[i] = rM;  dst[i+1] = gM;  dst[i+2] = bM;  dst[i+3] = im[i+3];
                
                // update image coordinates
                i+=4; x++; if (x>=w) { x=0; ty+=w; }
            }
            return dst;
        }
        
        ,"minimum": function( im, w, h ) {
            var 
                matRadius=this._dim, matHalfSide=matRadius>>1, matArea=matRadius*matRadius, 
                imageIndices=new A32I(this._indices),
                imLen=im.length, imArea=(imLen>>2), dst=new IMG(imLen),
                i, j, x, ty, xOff, yOff, srcOff, r, g, b, rM, gM, bM,
                matArea2=matArea<<1, bx=w-1, by=imArea-w
            ;
            
            // pre-compute indices, 
            // reduce redundant computations inside the main convolution loop (faster)
            for (j=0; j<matArea2; j+=2)
            { 
                // translate to image dimensions
                // the y coordinate
                imageIndices[j+1]*=w;
            }
            
            i=0; x=0; ty=0;
            while (i<imLen)
            {
                // calculate the weighed sum of the source image pixels that
                // fall under the convolution matrix
                rM=255; gM=255; bM=255; 
                j=0;
                while (j < matArea2)
                {
                    xOff=x + imageIndices[j]; yOff=ty + imageIndices[j+1];
                    if (xOff>=0 && xOff<=bx && yOff>=0 && yOff<=by)
                    {
                        srcOff=(xOff + yOff)<<2;
                        r=im[srcOff]; g=im[srcOff+1]; b=im[srcOff+2];
                        if (r<rM) rM=r; if (g<gM) gM=g; if (b<bM) bM=b;
                    }
                    j+=2;
                }
                
                // output
                dst[i] = rM;  dst[i+1] = gM; dst[i+2] = bM;  dst[i+3] = im[i+3];
                
                // update image coordinates
                i+=4; x++; if (x>=w) { x=0; ty+=w; }
            }
            return dst;
        }
    };
    
}(FILTER);