import { Router } from 'express';
import { mediaController, mediaIdParamSchema } from '../../controllers/media/MediaController';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { privateMediaService } from '../../services/media/PrivateMediaService';
import { postImageAccessResolver } from '../../services/social/post-media-access';
import { reportEvidenceMediaAccessResolver } from '../../services/reports/report-evidence-access';

// Private media is never served by express.static; each request re-checks access.
privateMediaService.registerResolver('post-image', postImageAccessResolver);
privateMediaService.registerResolver('report-evidence', reportEvidenceMediaAccessResolver);

const router = Router();
router.use(authenticate);
router.get('/:id', validate({ params: mediaIdParamSchema }), mediaController.download);

export default router;
