"use client";

import { SparklesIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import Dropzone from "react-dropzone";
import HomepageImage1 from "./images/homepage-image-1";
import HomepageImage2 from "./images/homepage-image-2";
import { StatusApp } from "@/app/page";
import { useToast } from "@/hooks/use-toast";
import { MAX_PDF_UPLOAD_BYTES } from "@/lib/pdf-upload";

export const HomeLandingDrop = ({
  status,
  file,
  setFile,
  handleSubmit,
}: {
  status: StatusApp;
  file?: File | null;
  setFile: (file: File | null) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) => {
  const { toast } = useToast();
  return (
    <div className="mx-auto mt-6 max-w-lg md:mt-10">
      <h1 className="text-center text-4xl font-bold md:text-5xl">
        Summarize PDFs
        <br /> in seconds
      </h1>
      <p className="mx-auto mt-6 max-w-md text-balance text-center leading-snug md:text-lg md:leading-snug">
        Upload a <strong>PDF</strong> to get a quick, clear, and shareable
        summary.
      </p>

      <form
        onSubmit={handleSubmit}
        className="relative mx-auto mt-20 max-w-md px-4 md:mt-16"
      >
        <div className="pointer-events-none absolute left-[-40px] top-[-185px] flex w-[200px] items-center md:-left-[calc(min(30vw,350px))] md:-top-20 md:w-[390px]">
          <HomepageImage1 />
        </div>
        <div className="pointer-events-none absolute right-[20px] top-[-110px] flex w-[70px] justify-center md:-right-[calc(min(30vw,350px))] md:-top-5 md:w-[390px]">
          <HomepageImage2 />
        </div>

        <div className="relative">
          <div className="flex flex-col rounded-xl bg-white px-6 py-6 shadow md:px-12 md:py-8">
            <label className="text-gray-500" htmlFor="file">
              Upload PDF
            </label>
            <Dropzone
              multiple={false}
              accept={{
                "application/pdf": [".pdf"],
              }}
              onDrop={(acceptedFiles) => {
                const file = acceptedFiles[0];
                if (!file) return;
                if (file.size > MAX_PDF_UPLOAD_BYTES) {
                  toast({
                    title: "📁 File Too Large",
                    description: "⚠️ File size must be less than 15MB",
                  });
                  return;
                }
                setFile(file);
              }}
            >
              {({ getRootProps, getInputProps, isDragAccept }) => (
                <div
                  className={`mt-2 flex aspect-video cursor-pointer items-center justify-center rounded-lg border border-dashed bg-gray-100 ${isDragAccept ? "border-blue-500" : "border-gray-250"}`}
                  {...getRootProps()}
                >
                  <input required={!file} {...getInputProps()} />
                  <div className="text-center">
                    {file ? (
                      <p>{file.name}</p>
                    ) : (
                      <Button type="button" className="md:text-base">
                        Select PDF
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Dropzone>
            <label className="mt-8 text-gray-500" htmlFor="language">
              Language
            </label>
            <Select defaultValue="english" name="language">
              <SelectTrigger className="mt-2 bg-gray-100" id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { label: "English", value: "english" },
                  { label: "German", value: "german" },
                  { label: "French", value: "french" },
                  { label: "Italian", value: "italian" },
                  { label: "Portuguese", value: "portuguese" },
                  { label: "Hindi", value: "hindi" },
                  { label: "Spanish", value: "spanish" },
                  { label: "Thai", value: "thai" },
                ].map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-8 text-center">
            <Button
              type="submit"
              variant="secondary"
              className="w-60 border bg-white/80 text-base font-semibold hover:bg-white md:w-auto"
              disabled={status === "parsing"}
            >
              <SparklesIcon />
              Generate
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
