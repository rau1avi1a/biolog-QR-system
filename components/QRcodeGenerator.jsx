"use client";

import React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Layout, LayoutGrid, LinkIcon, MailIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toPng } from "html-to-image";
import { saveAs } from "file-saver";

function QRcodeGenerator() {

  const [url, setUrl] = React.useState("");
  const [color, setColor] = React.useState("#1d1632");
  const [bgColor, setBgColor] = React.useState("#FFFFFF");
  const [logo, setLogo] = React.useState("/biologlogo.jpg");
  const [logoFile, setLogoFile] = React.useState(null);
  const [qrType, setQrType] = React.useState("link");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [accentColor, setAccentColor] = React.useState("#E0E1FF");

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setLogoFile(file ? file : null);
  };

  const handleDownload = () => {
    const qrCode = document.getElementById("qr-code");

    toPng(qrCode).then((dataUrl) => {
      saveAs(dataUrl, "qr-code.png");
    });
  };

  const handleEmailInput = () => {
    const mailToLink = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(message)}`;

    setUrl(mailToLink);
  };

  return (
    <div 
    className="relative z-10 mx-6 flex max-w-[1250px] w-full min-h-[700px] h-full">
      
      <Card 
      className="flex-1 flex flex-col w-full h-auto mx-auto bg-[#ecf7ff]/60 backdrop-blur-md shadow-sm border-2 border-white/40 rounded-xl">

        <CardHeader>
          
          <CardTitle 
          className="text-3xl font-bold text-center text-black">
            
            {/*Text*/}
            QR Code Generator
            
          </CardTitle>
        
        </CardHeader>

        <CardContent 
        className="flex-1">

          <div 
          className="h-full flex flex-col md:flex-row gap-8">

            <div 
            className="flex-1 space-y-6">

              <Tabs 
              defaultValue="link" 
              className="space-y-6" 
              onValueChange={(value) => setQrType(value)}>

                <TabsList
                className="h-10 w-full grid grid-cols-2 text-lg
                bg-[#afa5e4]">

                  <TabsTrigger 
                  value="link" 
                  className="text-white font-bold">

                    <LinkIcon 
                    className="w-4 h-4 mr-2" />

                    {/*Text*/}
                    link

                  </TabsTrigger>

                  <TabsTrigger 
                  value="email" 
                  className="text-white font-bold">

                    <MailIcon 
                    className="w-4 h-4 mr-2" />

                    {/*Text*/}
                    email

                  </TabsTrigger>

                </TabsList>

                <TabsContent 
                value="link">

                  <div 
                  className="space-y-6">

                    <div 
                    className="space-y-2">

                      <Label 
                      htmlFor="url" 
                      className="font-semibold">
                        
                        {/*Text*/}
                        URL

                      </Label>

                      <Input
                      id="url"
                      type="text"
                      value={url}
                      placeholder="https://example.com"
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full border-2 bg-transparent focus:border-black/70 border-white/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>

                    </div>

                  </div>

                </TabsContent>

                <TabsContent
                value="email">

                  <div
                  className="space-y-4">

                    <div
                    className="space-y-2">

                      <Label
                      htmlFor="email"
                      className="font-semibold">

                        {/*Text*/}
                        Email

                      </Label>

                      <Input
                      id="email"
                      type="email"
                      value={email}
                      placeholder="Enter email"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border-2 bg-transparent focus:border-black/70 border-white/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>
                    </div>

                    <div
                    className="space-y-2">

                      <Label
                      htmlFor="subject"
                      className="font-semibold">

                      {/*Text*/}
                      Subject

                      </Label>

                      <Input
                      id="subject"
                      type="text"
                      value={subject}
                      placeholder="Enter subject"
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full border-2 bg-transparent focus:border-black/70 border-white/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>

                    </div>

                    <div
                    className="space-y-2">

                      <Label
                      htmlFor="message"
                      className="font-semibold">
                        
                        {/*Text*/}
                        Message

                      </Label>

                      <Textarea
                      id="message"
                      value={message}
                      placeholder="Enter message..."
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full border-2 bg-transparent focus:border-black/70 border-white/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400 h-24 resize-none"/>
                    </div>

                    <Button
                    className="py-7 px-8 bg-[#afa5e4] font-bold rounded-full uppercase"
                    onClick={() => handleEmailInput()}>
                      
                      {/*Text*/}
                      Generate email QR code
                    
                    </Button>

                  </div>

                </TabsContent>

              </Tabs>

              <div
              className="space-y-4">

                <div
                className="flex space-x-4">

                  <div
                  className="space-y-2 flex-1">

                    <Label
                    htmlFor="color"
                    className="font-semibold">
                      
                      {/*Text*/}
                      QR Code Color

                    </Label>

                    <div
                    className="flex items-center gap-1">

                      <div
                      className="relative w-12 flex-1 h-12 rounded-lg border-2 border-white/70"
                      style={{ backgroundColor: color }}>

                        <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                        
                      </div>

                      <Input
                      type="text"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-12 flex-1 border-2 bg-transparent border-white/70 focus:border-black/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>

                    </div>

                  </div>

                  <div
                  className="space-y-2 flex-1">

                    <Label
                    htmlFor="color"
                    className="font-semibold">
                      
                      {/*Text*/}
                      Background Color

                    </Label>

                    <div
                    className="flex items-center gap-1">

                      <div
                      className="relative w-12 flex-1 h-12 rounded-lg border-2 border-white/70"
                      style={{ backgroundColor: bgColor }}>

                        <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                        
                      </div>

                      <Input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-12 flex-1 border-2 bg-transparent border-white/70 focus:border-black/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>

                    </div>

                  </div>

                </div>

              </div>

              <div
              className="space-y-2">

                <Label
                htmlFor="logo"
                className="font-semibold">
                  
                  {/*Text*/}
                  Logo

                </Label>

                <Input
                type="file"
                id="logo"
                accept="image/*"
                onChange={(e) => {
                  if(e.target.files && e.target.files[0]) {
                    setLogoFile(e.target.files[0]);

                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLogo(reader.result);
                    };
                    reader.readAsDataURL(e.target.files[0]);
                    
                  }
                }}
                className="w-full border-2 bg-transparent focus:border-black/70 border-white/70 rounded-lg outline-none focus-visible:ring-0 placeholder:text-gray-400"/>

              </div>

            </div>

            <div 
            className="relative flex-1 bg-[#E0E1FF] rounded-lg flex flex-col justify-center space-y-6">

              <span>

                <LayoutGrid
                className="w-8 h-8 text-white absolute top-4 right-4">

                </LayoutGrid>

              </span>

              <div
              id="qr-code"
              className="flex justify-center p-8">

                <div
                className="relative">

                  <QRCodeSVG
                  value={url}
                  size={256}
                  fgColor={color}
                  bgColor={bgColor}
                  imageSettings={logo ? { src: logo, height: 35, width: 80, excavate: true } : undefined}/>

                </div>

              </div>

              <div
              className="flex justify-center space-x-4">

                <Button
                variant="outline"
                onClick={() => handleDownload()}>

                  <Download
                  className="w-4 h-4 mr-2"/>
                  {/*Text*/}
                  Download PNG

                </Button>

              </div>

            </div>

          </div>
      
        </CardContent>

      </Card>

    </div>
  );
}  

export default QRcodeGenerator;