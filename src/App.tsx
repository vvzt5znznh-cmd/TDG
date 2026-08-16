import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppChrome } from "./ui/chrome";
import { EditorPage } from "./ui/EditorPage";
import { LibraryPage } from "./ui/LibraryPage";
import { PrintPage } from "./ui/print/PrintPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppChrome>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/edit" element={<EditorPage />} />
          <Route path="/print/student" element={<PrintPage audience="student" />} />
          <Route path="/print/facilitator" element={<PrintPage audience="facilitator" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppChrome>
    </BrowserRouter>
  );
}
