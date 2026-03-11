import { Request, Response, NextFunction } from 'express';
import pool from '../db';

export interface FamilyRecord {
  id: number;
  name: string;
  code: string;
}

// Augment Express Request to carry the resolved family
declare global {
  namespace Express {
    interface Request {
      family: FamilyRecord;
    }
  }
}

export async function familyMiddleware(req: Request, res: Response, next: NextFunction) {
  const { familyCode } = req.params;
  if (!familyCode) return res.status(400).json({ error: 'קוד משפחה חסר' });

  try {
    const { rows } = await pool.query(
      'SELECT id, name, code FROM families WHERE code = $1',
      [familyCode.toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'משפחה לא נמצאה' });
    }
    req.family = rows[0] as FamilyRecord;
    next();
  } catch (err) {
    console.error('familyMiddleware error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
}
