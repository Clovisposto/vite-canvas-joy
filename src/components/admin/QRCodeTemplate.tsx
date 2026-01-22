import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeTemplateProps {
  url: string;
  pointName?: string;
  pointLocation?: string;
  attendantName?: string;
  size?: 'full' | 'compact';
}

export const QRCodeTemplate = forwardRef<HTMLDivElement, QRCodeTemplateProps>(
  ({ url, pointName, pointLocation, attendantName, size = 'full' }, ref) => {
    const isCompact = size === 'compact';
    
    return (
      <div 
        ref={ref}
        className={`bg-white ${isCompact ? 'w-[280px]' : 'w-[595px]'} mx-auto`}
        style={{ 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          aspectRatio: isCompact ? '1' : '210/297' // A4 proportion
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between ${isCompact ? 'px-3 py-2' : 'px-6 py-4'}`}>
          {/* Logo Left */}
          <div className="flex items-center gap-2">
            <div 
              className={`${isCompact ? 'w-8 h-8' : 'w-12 h-12'} rounded-lg flex items-center justify-center`}
              style={{ backgroundColor: '#E85A5A' }}
            >
              <span className={`text-white font-bold ${isCompact ? 'text-lg' : 'text-2xl'}`}>P</span>
            </div>
            <div>
              <h1 
                className={`font-bold ${isCompact ? 'text-xs' : 'text-lg'}`}
                style={{ color: '#4A5568' }}
              >
                AUTO POSTO PARÁ
              </h1>
              <p 
                className={`${isCompact ? 'text-[8px]' : 'text-xs'} uppercase tracking-wide`}
                style={{ color: '#718096' }}
              >
                Combustível & Lubrificantes
              </p>
            </div>
          </div>
          
          {/* Slogan Right */}
          <div 
            className={`${isCompact ? 'px-2 py-1 text-[7px]' : 'px-4 py-2 text-xs'} text-white font-medium rounded`}
            style={{ backgroundColor: '#E85A5A' }}
          >
            Confiança, Qualidade e Compromisso
          </div>
        </div>

        {/* Main Content - QR Code Area */}
        <div 
          className={`flex-1 flex flex-col items-center justify-center relative ${isCompact ? 'py-4' : 'py-12'}`}
          style={{ minHeight: isCompact ? '180px' : '500px' }}
        >
          {/* Watermark */}
          <div 
            className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none"
          >
            <div className={`${isCompact ? 'w-40' : 'w-80'} flex items-center gap-3`}>
              <div 
                className={`${isCompact ? 'w-16 h-16' : 'w-32 h-32'} rounded-2xl flex items-center justify-center`}
                style={{ backgroundColor: '#4A5568' }}
              >
                <span className={`text-white font-bold ${isCompact ? 'text-3xl' : 'text-6xl'}`}>P</span>
              </div>
              <div>
                <span className={`font-bold ${isCompact ? 'text-xl' : 'text-4xl'}`} style={{ color: '#4A5568' }}>
                  AUTO POSTO PARÁ
                </span>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className={`bg-white ${isCompact ? 'p-2' : 'p-4'} rounded-xl shadow-lg relative z-10`}>
            <QRCodeSVG 
              value={url} 
              size={isCompact ? 120 : 200}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Call to Action */}
          <p 
            className={`${isCompact ? 'text-sm mt-2' : 'text-xl mt-6'} font-bold`}
            style={{ color: '#E85A5A' }}
          >
            📱 Escaneie e participe!
          </p>

          {/* Point Info */}
          {(pointName || pointLocation || attendantName) && (
            <div className={`${isCompact ? 'mt-2' : 'mt-4'} text-center`}>
              {pointName && (
                <p 
                  className={`font-semibold ${isCompact ? 'text-xs' : 'text-lg'}`}
                  style={{ color: '#4A5568' }}
                >
                  {pointName}
                </p>
              )}
              {pointLocation && (
                <p 
                  className={`${isCompact ? 'text-[10px]' : 'text-sm'}`}
                  style={{ color: '#718096' }}
                >
                  {pointLocation}
                </p>
              )}
              {attendantName && (
                <p 
                  className={`${isCompact ? 'text-[10px]' : 'text-sm'}`}
                  style={{ color: '#718096' }}
                >
                  Frentista: {attendantName}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'} text-white`}
          style={{ backgroundColor: '#E85A5A' }}
        >
          <div className={`flex ${isCompact ? 'flex-col gap-1' : 'justify-between items-center'}`}>
            <div className={`flex items-center gap-4 ${isCompact ? 'text-[8px] flex-wrap gap-2' : 'text-xs'}`}>
              <span>📄 CNPJ: 17.644.011/0001-07</span>
              <span>✉️ autopostopara@gmail.com</span>
            </div>
            <div className={`flex items-center gap-4 ${isCompact ? 'text-[8px] flex-wrap gap-2' : 'text-xs'}`}>
              <span>📍 Av. Sete de Setembro, nº 127, Belém - Tucuruí/PA</span>
              <span>📞 (94) 99155-0011 / 99281-9113</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

QRCodeTemplate.displayName = 'QRCodeTemplate';

export default QRCodeTemplate;
