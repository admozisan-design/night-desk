import {redirect} from "next/navigation";

// Existing analysis data is retained; the extra screen is no longer exposed.
export default function AnalyticsPage(){redirect("/");}
