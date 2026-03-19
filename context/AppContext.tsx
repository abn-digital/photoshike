import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Template {
    id: string;
    name: string;
    ratio: string;
    category: 'Exterior' | 'Interior' | 'Details';
}

export interface Project {
    id: string;
    jobId: string;
    color: string;
    batch: string;
    notes: string;
    templateName: string;
    ratio: string;
    date: string;
    photoUri: string | null;
    filename: string;
    status: 'uploaded' | 'pending';
}

interface AppState {
    photographerName: string;
    setPhotographerName: (name: string) => void;
    selectedTemplate: Template | null;
    setSelectedTemplate: (t: Template | null) => void;
    overlayOpacity: number;
    setOverlayOpacity: (v: number) => void;
    overlayLocked: boolean;
    setOverlayLocked: (v: boolean) => void;
    gridVisible: boolean;
    setGridVisible: (v: boolean) => void;
    guidesVisible: boolean;
    setGuidesVisible: (v: boolean) => void;
    capturedPhotoUri: string | null;
    setCapturedPhotoUri: (uri: string | null) => void;
    defaultAspectRatio: string;
    setDefaultAspectRatio: (r: string) => void;
    autoFilename: boolean;
    setAutoFilename: (v: boolean) => void;
    projects: Project[];
    addProject: (p: Project) => void;
    clearProjects: () => void;
    wheelbaseScale: number;
    setWheelbaseScale: (v: number) => void;
    featureWidthScale: number;
    setFeatureWidthScale: (v: number) => void;
    verticalOffset: number;
    setVerticalOffset: (v: number) => void;
}

const AppContext = createContext<AppState | null>(null);

const PROJECTS_KEY = '@photoshike_projects';

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [photographerName, setPhotographerName] = useState('Photographer');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0.4);
    const [overlayLocked, setOverlayLocked] = useState(false);
    const [gridVisible, setGridVisible] = useState(false);
    const [guidesVisible, setGuidesVisible] = useState(true);
    const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
    const [defaultAspectRatio, setDefaultAspectRatio] = useState('4:5');
    const [autoFilename, setAutoFilename] = useState(true);
    const [projects, setProjects] = useState<Project[]>([]);
    const [wheelbaseScale, setWheelbaseScale] = useState(1.0);
    const [featureWidthScale, setFeatureWidthScale] = useState(1.0);
    const [verticalOffset, setVerticalOffset] = useState(0.0);

    useEffect(() => {
        AsyncStorage.getItem(PROJECTS_KEY).then(raw => {
            if (raw) setProjects(JSON.parse(raw));
        });
    }, []);

    const addProject = (p: Project) => {
        const updated = [p, ...projects];
        setProjects(updated);
        AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
    };

    const clearProjects = () => {
        setProjects([]);
        AsyncStorage.removeItem(PROJECTS_KEY);
    };

    return (
        <AppContext.Provider value={{
            photographerName, setPhotographerName,
            selectedTemplate, setSelectedTemplate,
            overlayOpacity, setOverlayOpacity,
            overlayLocked, setOverlayLocked,
            gridVisible, setGridVisible,
            guidesVisible, setGuidesVisible,
            capturedPhotoUri, setCapturedPhotoUri,
            defaultAspectRatio, setDefaultAspectRatio,
            autoFilename, setAutoFilename,
            projects, addProject, clearProjects,
            wheelbaseScale, setWheelbaseScale,
            featureWidthScale, setFeatureWidthScale,
            verticalOffset, setVerticalOffset,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppState() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useAppState must be used inside AppProvider');
    return ctx;
}

export function buildFilename(jobId: string, templateName: string, photographerName: string): string {
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const parts = [date, jobId || 'NOJOB', (templateName || 'NoTemplate').replace(/\s+/g, ''), photographerName.replace(/\s+/g, '')];
    return parts.join('_') + '.jpg';
}
