/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Download, FileText, Building2, User, MapPin, Euro, Calendar as CalendarIcon, Heart, Loader2, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Toaster, toast } from 'sonner';

interface CertificateData {
  companyName: string;
  cif: string;
  address: string;
  amount: string;
  date: string;
  representative: string;
  association: string;
  associationCif: string;
  event: string;
  purpose: string;
}

const initialData: CertificateData = {
  companyName: 'SERVITEL XXI',
  cif: 'B91029660',
  address: 'C/ ASTRONOMIA 1, T3, PLTA 2 MODULO 4 41015 (SEVILLA)',
  amount: '200',
  date: format(new Date(), 'yyyy-MM-dd'),
  representative: 'María del Pilar López Rodríguez',
  association: 'Asociación CONFETICIDAD',
  associationCif: 'G56319999',
  event: 'III Marcha Solidaria de la Alegría',
  purpose: 'la investigación contra el cáncer',
};

export default function App() {
  const [data, setData] = useState<CertificateData>(initialData);
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const generatePDF = async () => {
    const element = certificateRef.current;
    if (!element) {
      toast.error('No se pudo encontrar el elemento del certificado.');
      return;
    }
    
    setIsGenerating(true);
    const toastId = toast.loading('Preparando descarga segura...');

    try {
      // Ensure fonts are loaded
      await document.fonts.ready;
      
      // Small delay to ensure any pending renders are complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      let dataUrl = '';
      try {
        // Use html-to-image as primary method as it's more accurate for modern CSS
        dataUrl = await htmlToImage.toPng(element, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          style: {
            transform: 'none',
            margin: '0',
            width: '794px',
            minHeight: '1123px',
            letterSpacing: 'normal',
            wordSpacing: 'normal',
          }
        });
      } catch (captureError) {
        console.warn('html-to-image failed, trying html2canvas fallback...', captureError);
        // Fallback to html2canvas if html-to-image fails
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          windowWidth: 794,
          onclone: (clonedDoc) => {
            const el = clonedDoc.getElementById('certificate-to-capture');
            if (el) {
              el.style.transform = 'none';
              el.style.position = 'static';
              el.style.margin = '0';
              el.style.width = '794px';
              el.style.minHeight = '1123px';
              el.style.letterSpacing = 'normal';
              el.style.wordSpacing = 'normal';
            }
          }
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      if (!dataUrl || dataUrl.length < 500) {
        throw new Error('La imagen generada está vacía o es demasiado pequeña.');
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Create an image object to get the real dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => {
        img.onload = resolve;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const ratio = imgWidth / imgHeight;
      
      // Calculate dimensions to fit A4 while maintaining aspect ratio
      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth / ratio;
      
      // If the calculated height is more than A4 height, scale by height instead
      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * ratio;
      }

      // Center the image in the PDF page
      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      
      const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(dataUrl, format, xOffset, yOffset, finalWidth, finalHeight, undefined, 'SLOW');
      
      // Save the PDF
      const safeCompanyName = data.companyName.trim().replace(/[^a-z0-9]/gi, '_') || 'Empresa';
      const fileName = `Certificado_Donacion_${safeCompanyName}.pdf`;
      
      pdf.save(fileName);
      
      toast.success('¡Certificado descargado con éxito!', { id: toastId });
    } catch (error) {
      console.error('Error detallado al generar PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      toast.error(`Fallo técnico: ${errorMessage}.`, { 
        id: toastId,
        duration: 8000,
        icon: <AlertCircle className="text-red-500" />,
        action: {
          label: 'Ayuda',
          onClick: () => window.open('https://support.google.com/chrome/answer/95669', '_blank')
        }
      });
      
      // Fallback: try to download as image at least
      toast.info('Intentando descarga como imagen de respaldo...');
      try {
        const imgUrl = await htmlToImage.toJpeg(element, { quality: 0.8 });
        const link = document.createElement('a');
        link.download = `Certificado_${data.companyName.replace(/ /g, '_')}.jpg`;
        link.href = imgUrl;
        link.click();
        toast.success('Descargado como imagen (JPG)');
      } catch (imgError) {
        console.error('Fallback image failed too:', imgError);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <Toaster position="top-right" richColors />
      
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        
        {/* Form Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit sticky top-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600">
              <FileText size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Datos del Certificado</h1>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                  <Building2 size={12} /> Empresa Colaboradora
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={data.companyName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                  <FileText size={12} /> CIF Empresa
                </label>
                <input
                  type="text"
                  name="cif"
                  value={data.cif}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="CIF"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                <MapPin size={12} /> Domicilio Social
              </label>
              <textarea
                name="address"
                value={data.address}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                placeholder="Dirección completa"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                  <Euro size={12} /> Importe (€)
                </label>
                <input
                  type="number"
                  name="amount"
                  value={data.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                  <CalendarIcon size={12} /> Fecha
                </label>
                <input
                  type="date"
                  name="date"
                  value={data.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-2">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Asociación</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                    <User size={12} /> Representante
                  </label>
                  <input
                    type="text"
                    name="representative"
                    value={data.representative}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 flex items-center gap-2">
                    <Heart size={12} /> Asociación
                  </label>
                  <input
                    type="text"
                    name="association"
                    value={data.association}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Evento / Motivo</label>
              <input
                type="text"
                name="event"
                value={data.event}
                onChange={handleInputChange}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>

            <button
              onClick={generatePDF}
              disabled={isGenerating}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
            >
              {isGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
              )}
              {isGenerating ? 'Generando PDF...' : 'Descargar Certificado PDF'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-2">
              Si el error persiste, intenta abrir la aplicación en una pestaña nueva.
            </p>
          </div>
        </motion.div>

        {/* Preview Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vista Previa Profesional (A4)</h2>
          </div>
          
          <div className="bg-slate-300 p-2 md:p-4 rounded-2xl overflow-auto flex justify-center shadow-inner h-[600px] lg:h-[calc(100vh-140px)] sticky top-8 relative">
            {/* Scaling Wrapper to prevent preview from being cut off */}
            <div className="flex justify-center items-start origin-top transition-transform duration-300" style={{ transform: 'scale(var(--preview-scale, 0.3))', width: '210mm' }}>
              <style dangerouslySetInnerHTML={{ __html: `
                :root { --preview-scale: 0.25; }
                @media (min-width: 480px) { :root { --preview-scale: 0.3; } }
                @media (min-width: 640px) { :root { --preview-scale: 0.4; } }
                @media (min-width: 768px) { :root { --preview-scale: 0.5; } }
                @media (min-width: 1024px) { :root { --preview-scale: 0.45; } }
                @media (min-width: 1280px) { :root { --preview-scale: 0.6; } }
                @media (min-width: 1536px) { :root { --preview-scale: 0.75; } }
                @media (min-width: 1920px) { :root { --preview-scale: 0.9; } }
              `}} />
              {/* The actual certificate template - REPLICATING THE ORIGINAL IMAGE */}
              <div 
                id="certificate-to-capture"
                ref={certificateRef}
                className="bg-white w-[210mm] min-h-[297mm] shadow-2xl flex flex-col text-[#333333] relative shrink-0"
                style={{ 
                  fontSize: '15pt', 
                  lineHeight: '1.7',
                  fontFamily: "'Inter', sans-serif",
                  width: '210mm',
                  minHeight: '297mm',
                  boxSizing: 'border-box',
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                  textAlign: 'left'
                }}
              >
                <div className="px-[12mm] py-[25mm] flex flex-col h-full w-full">
                  <style dangerouslySetInnerHTML={{ __html: `
                    #certificate-to-capture p {
                      white-space: normal !important;
                      word-break: break-word !important;
                      line-height: 1.7 !important;
                      margin-bottom: 1.8rem !important;
                      text-align: justify;
                    }
                    #certificate-to-capture span {
                      display: inline !important;
                    }
                    .serif-title {
                      font-family: 'Playfair Display', serif !important;
                    }
                  ` }} />
                  
                  {/* Header Section - Blue Title and Orange Line */}
                  <div className="text-center mb-14">
                    <h1 className="text-[25pt] font-bold serif-title text-[#1a2b6d] uppercase tracking-tight mb-6">
                      Certificado de Donación
                    </h1>
                    <div className="h-2 w-full bg-[#d48c1f]"></div>
                  </div>

                {/* Body Text */}
                <div className="space-y-6 text-left">
                  <p>
                    Yo, <span className="font-bold">{data.representative}</span> en calidad de representante legal de 
                    la Asociación <span className="font-bold">{data.association.toUpperCase()}</span> con CIF <span className="font-bold">{data.associationCif}</span>, certifico que 
                    <span className="font-bold"> {data.companyName} con CIF: {data.cif} y domicilio en {data.address}</span>, ha realizado una donación de <span className="font-bold">{data.amount}€</span> a nuestra asociación sin ánimo de lucro.
                  </p>

                  <p>
                    Agradecemos su apoyo en nuestra <span className="font-bold">{data.event}</span>, cuyos beneficios serán destinados a {data.purpose}.
                  </p>

                  <p>
                    Es importante destacar que esta donación no está contemplada dentro de la ley de mecenazgo y, por lo tanto, no se podrá deducir fiscalmente.
                  </p>

                  <p>
                    Agradecemos nuevamente a <span className="font-bold">{data.companyName}</span> por su solidaridad y generosidad. Su contribución es fundamental para seguir adelante con nuestros proyectos y programas solidarios.
                  </p>
                </div>

                {/* Signature Section */}
                <div className="mt-12 space-y-2">
                  <p>Atentamente,</p>
                  <p className="font-medium">{data.representative}</p>
                  <p className="">{formattedDate(data.date)}</p>
                  
                  <div className="pt-4">
                    <img 
                      src="/signature.png" 
                      alt="Firma" 
                      className="h-32 w-auto object-contain -rotate-2 mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                {/* Professional Logo */}
                <div className="mt-auto pt-6 flex justify-center">
                  <img 
                    src="/logo.png" 
                    alt="Confeticidad Logo" 
                    className="h-60 w-auto object-contain" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
