import "./globals.css";

export const metadata = {
  title: "PND Bank - Modern Online & Crypto Banking",
  description: "Experience premium digital banking integrated with crypto asset management in one unified platform.",
  icons: {
    icon: "/pnd_logo.png",
    shortcut: "/pnd_logo.png",
    apple: "/pnd_logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Bootstrap 5 CSS */}
        <link 
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" 
          rel="stylesheet" 
          crossOrigin="anonymous"
        />
        {/* FontAwesome Icons */}
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
          rel="stylesheet" 
          crossOrigin="anonymous" 
        />
        {/* SweetAlert2 for Premium Modals */}
        <link 
          href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-bootstrap-4/bootstrap-4.css" 
          rel="stylesheet"
        />
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11" defer></script>
      </head>
      <body className="h-full bg-light text-dark">
        {children}
        
        {/* Bootstrap 5 Bundle JS */}
        <script 
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" 
          defer 
          crossOrigin="anonymous"
        ></script>
      </body>
    </html>
  );
}
