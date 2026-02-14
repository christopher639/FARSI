import { useEffect, useMemo, useState } from "react";
import { Crosshair, Loader2, MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

type CrimeReport = {
  id: string;
  crime_id: string;
  crime_type: string | null;
  context: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  reported_by: string | null;
  month: string | null;
  created_at: string;
};

type LocationState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

const CRIME_TYPES = [
  "Robbery",
  "Burglary",
  "Assault",
  "Vehicle crime",
  "Public disorder",
  "Suspicious activity",
  "Other",
];

export default function CrimeReportPage() {
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reports, setReports] = useState<CrimeReport[]>([]);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [formData, setFormData] = useState({
    crimeType: CRIME_TYPES[0],
    locationLabel: "",
    description: "",
  });

  const fetchRecentReports = async () => {
    try {
      setLoadingReports(true);
      const data = await apiGet<CrimeReport[]>("/crime-reports");
      setReports(data || []);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to load recent crime reports"));
    } finally {
      setLoadingReports(false);
    }
  };

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported on this device");
    }

    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 5000,
        });
      });

      const nextLocation: LocationState = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date().toISOString(),
      };
      setLocation(nextLocation);
      return nextLocation;
    } catch (err: unknown) {
      throw new Error(getErrorMessage(err, "Unable to capture location from this device"));
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    void fetchRecentReports();
    void captureLocation().catch((err: unknown) => {
      toast.warning(getErrorMessage(err, "Allow location access before reporting"));
    });
  }, []);

  const locationCapturedLabel = useMemo(() => {
    if (!location) return "No device location captured yet";
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (±${Math.round(location.accuracy)}m)`;
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.crimeType.trim()) {
      toast.error("Crime type is required");
      return;
    }

    setSubmitting(true);
    try {
      const freshLocation = await captureLocation().catch(() => location);
      if (!freshLocation) {
        throw new Error("Location is required. Enable GPS/location services and try again.");
      }

      await apiPost("/crime-reports", {
        crime_type: formData.crimeType.trim(),
        description: formData.description.trim() || null,
        location_label: formData.locationLabel.trim() || null,
        latitude: freshLocation.latitude,
        longitude: freshLocation.longitude,
        reported_at: new Date().toISOString(),
      });

      toast.success("Crime event recorded in real time");
      setFormData((prev) => ({
        ...prev,
        locationLabel: "",
        description: "",
      }));
      await fetchRecentReports();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to submit crime report"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Real-Time Crime Reporting</h1>
        <p className="text-muted-foreground">
          Security agents can submit crime events with automatic device latitude/longitude capture.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border-panel-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              Report New Crime Event
            </CardTitle>
            <CardDescription>
              Location is captured from this reporting device at submit time for accurate incident logging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crime-type">Crime Type</Label>
                  <select
                    id="crime-type"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={formData.crimeType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, crimeType: e.target.value }))}
                  >
                    {CRIME_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-label">Location Label</Label>
                  <Input
                    id="location-label"
                    placeholder="Street, block, checkpoint, district..."
                    value={formData.locationLabel}
                    onChange={(e) => setFormData((prev) => ({ ...prev, locationLabel: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Incident Description</Label>
                <Textarea
                  id="description"
                  rows={5}
                  placeholder="Describe what happened, suspects, and immediate risk..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="rounded-lg border border-panel-border p-3 bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <div className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Device Coordinates
                    </div>
                    <p className="text-muted-foreground">{locationCapturedLabel}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void captureLocation()} disabled={locating}>
                    {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                    <span className="ml-2">Refresh GPS</span>
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={submitting || locating} className="w-full md:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                <span className="ml-2">{submitting ? "Submitting..." : "Submit Crime Report"}</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-panel-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Recent Reports
            </CardTitle>
            <CardDescription>Latest field reports submitted by agents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingReports && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loadingReports && reports.length === 0 && (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            )}
            {!loadingReports &&
              reports.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-lg border border-panel-border p-3 text-sm">
                  <p className="font-medium">{item.crime_type || "Unknown type"}</p>
                  <p className="text-muted-foreground text-xs">{new Date(item.created_at).toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}
                  </p>
                  {item.location && <p className="text-xs mt-1">{item.location}</p>}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
