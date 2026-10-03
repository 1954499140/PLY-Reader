/** Fill only short gaps bracketed by existing, similarly coloured pixels; no extrapolation. */
export function interpolateHoles(pixels:Uint8ClampedArray,width:number,height:number,radius:number){
 if(!Number.isInteger(radius)||radius<0||radius>4)throw Error('插值半径必须在 0–4 之间');
 if(pixels.length!==width*height*4)throw Error('像素尺寸不匹配');if(!radius)return pixels;
 const output=new Uint8ClampedArray(pixels),directions=[[1,0],[0,1],[1,1],[1,-1]];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(y*width+x)*4;if(pixels[at+3]>32)continue;
  let best=Infinity,left=-1,right=-1,fraction=0;
  for(const[dx,dy]of directions){let a=-1,b=-1,da=0,db=0;
   for(let s=1;s<=radius;s++){const xx=x-dx*s,yy=y-dy*s;if(xx<0||xx>=width||yy<0||yy>=height)break;const i=(yy*width+xx)*4;if(pixels[i+3]>128){a=i;da=s;break;}}
   if(a<0)continue;
   for(let s=1;s<=radius;s++){const xx=x+dx*s,yy=y+dy*s;if(xx<0||xx>=width||yy<0||yy>=height)break;const i=(yy*width+xx)*4;if(pixels[i+3]>128){b=i;db=s;break;}}
   if(b<0)continue;
   const distance=(da+db)*Math.hypot(dx,dy),difference=Math.max(Math.abs(pixels[a]-pixels[b]),Math.abs(pixels[a+1]-pixels[b+1]),Math.abs(pixels[a+2]-pixels[b+2]));
   if(distance<best&&difference<90){best=distance;left=a;right=b;fraction=da/(da+db);}
  }
  if(left>=0){for(let c=0;c<3;c++)output[at+c]=pixels[left+c]*(1-fraction)+pixels[right+c]*fraction;output[at+3]=255;}
 }return output;
}
