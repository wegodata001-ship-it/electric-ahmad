"use client";

import { Card } from "@/components/ui";
import { currentUser } from "@/mock";
import { Avatar } from "@/components/ui";
import { Bell, Shield, Database } from "lucide-react";

export function SettingsPage() {
  const sections = [
    {
      title: "פרופיל",
      icon: Shield,
      items: [
        { label: "שם", value: currentUser.name },
        { label: "אימייל", value: currentUser.email },
        { label: "תפקיד", value: currentUser.role },
      ],
    },
    {
      title: "התראות",
      icon: Bell,
      items: [
        { label: "דיווחי עובדים", value: "מופעל" },
        { label: "מסמכים חדשים", value: "מופעל" },
        { label: "חשבונות חלקיים", value: "מופעל" },
        { label: "סיום סעיפים", value: "מופעל" },
      ],
    },
    {
      title: "מערכת",
      icon: Database,
      items: [
        { label: "גרסה", value: "1.0.0" },
        { label: "סביבה", value: "Development (Mock Data)" },
        { label: "מסד נתונים", value: "לא מחובר" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-sm text-gray-500 mt-1">ניהול הגדרות המערכת</p>
      </div>

      <Card padding="lg">
        <div className="flex items-center gap-4">
          <Avatar src={currentUser.avatarUrl} name={currentUser.name} size="xl" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{currentUser.name}</h2>
            <p className="text-sm text-gray-500">{currentUser.email}</p>
            <p className="text-xs text-primary-600 mt-1">{currentUser.role}</p>
          </div>
        </div>
      </Card>

      {sections.map((section) => (
        <Card key={section.title} padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <section.icon className="h-5 w-5 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
          </div>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
